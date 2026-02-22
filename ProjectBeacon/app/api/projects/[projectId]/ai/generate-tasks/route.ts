import { z } from "zod";
import { NextResponse } from "next/server";
import { buildPlanningDocumentContextBlocks } from "@/lib/ai/document-context";
import { generateTaskPlan } from "@/lib/ai/generate-task-plan";
import {
  countClarificationEntries,
  fetchActiveProjectContexts,
} from "@/lib/ai/context-store";
import { buildClarificationState } from "@/lib/ai/context-confidence";
import {
  mapTaskDependencyRowToDto,
  mapTaskRowToDto,
  mapTaskSkillRowToDto,
} from "@/lib/tasks/dto";
import { validateDependencyGraph } from "@/lib/tasks/validate-dependency-graph";
import { jsonError } from "@/lib/server/errors";
import {
  mapRouteError,
  parseBody,
  requireProjectAccess,
} from "@/lib/server/route-helpers";
import { normalizeProjectRole } from "@/lib/server/project-access";
import { insertRows, selectRows, upsertRows } from "@/lib/server/supabase-rest";
import type {
  SkillRow,
  TaskDependencyRow,
  TaskRequiredSkillRow,
  TaskRow,
} from "@/types/planning";

type TaskInsertRow = {
  project_id: string;
  assignee_user_id: string | null;
  title: string;
  description: string;
  difficulty_points: 1 | 2 | 3 | 5 | 8;
  status: "todo";
  due_at: string | null;
};

const generateTasksRequestSchema = z.object({
  allowLowConfidenceProceed: z.boolean().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const access = await requireProjectAccess(request, projectId);
    if (!access.ok) {
      return access.response;
    }

    if (access.project.planning_status !== "draft") {
      return jsonError(
        409,
        "INVALID_STATE",
        "Tasks can only be generated while planning status is draft.",
      );
    }

    let rawBody = "";
    try {
      rawBody = await request.text();
    } catch {
      return jsonError(400, "VALIDATION_ERROR", "Invalid request body.");
    }
    let requestBody: unknown = {};
    if (rawBody.trim().length > 0) {
      try {
        requestBody = JSON.parse(rawBody);
      } catch {
        return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body.");
      }
    }

    const parsedBody = parseBody(generateTasksRequestSchema, requestBody);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }
    const allowLowConfidenceProceed =
      parsedBody.data.allowLowConfidenceProceed === true;

    const contexts = await fetchActiveProjectContexts(projectId);
    const askedCount = countClarificationEntries(contexts);
    const clarificationState = await buildClarificationState({
      projectName: access.project.name,
      projectDescription: access.project.description,
      projectDeadline: access.project.deadline,
      contexts,
      askedCount,
    });

    if (!clarificationState.readyForGeneration && !allowLowConfidenceProceed) {
      return jsonError(
        409,
        "CONTEXT_NOT_READY",
        "Clarification loop must complete before generation.",
        {
          confidence: clarificationState.confidence,
          threshold: clarificationState.threshold,
        },
      );
    }
    const planningMode = clarificationState.readyForGeneration
      ? "standard"
      : "provisional";

    const existingSkills = await selectRows<SkillRow>("skills", {
      select: "id,name",
      order: "name.asc",
    });

    const role = normalizeProjectRole(access.membership.role);
    const documentContextBlocks = await buildPlanningDocumentContextBlocks({
      projectId,
      actorUserId: access.userId,
      role,
    });
    const contextBlocks = [
      ...contexts.map((entry) => ({
        contextType: entry.context_type,
        textContent: entry.text_content,
      })),
      ...documentContextBlocks,
    ];

    console.info("[generateTaskPlan] prompt context summary", {
      projectId,
      contextBlocks: contextBlocks.length,
      documentContextBlocks: documentContextBlocks.length,
    });

    const strictMode = process.env.AI_GENERATION_STRICT_MODE !== "false";
    const generatedResult = await generateTaskPlan(
      {
        projectName: access.project.name,
        projectDescription: access.project.description,
        projectDeadline: access.project.deadline,
        contextBlocks,
        availableSkills: existingSkills.map((skill) => skill.name),
        planningMode,
        clarification: {
          confidence: clarificationState.confidence,
          threshold: clarificationState.threshold,
          readyForGeneration: clarificationState.readyForGeneration,
          askedCount: clarificationState.askedCount,
          maxQuestions: clarificationState.maxQuestions,
        },
      },
      { strictMode },
    );
    const generated = generatedResult.plan;

    const tempIds = generated.tasks.map((task) => task.tempId);
    const dependencyEdges = generated.tasks.flatMap((task) =>
      task.dependsOnTempIds.map((dependsOnTempId) => ({
        taskId: task.tempId,
        dependsOnTaskId: dependsOnTempId,
      })),
    );

    const dependencyValidation = validateDependencyGraph(
      tempIds,
      dependencyEdges,
    );
    if (!dependencyValidation.ok) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Generated dependency graph is invalid.",
        {
          reason: dependencyValidation.reason,
          edge: dependencyValidation.edge,
        },
      );
    }

    const rowsToInsert: TaskInsertRow[] = generated.tasks.map((task) => ({
      project_id: projectId,
      assignee_user_id: null,
      title: task.title,
      description: task.description,
      difficulty_points: task.difficultyPoints,
      status: "todo",
      due_at: task.dueAt,
    }));

    const insertedTasks: TaskRow[] = [];
    for (const row of rowsToInsert) {
      const [inserted] = await insertRows<TaskRow, TaskInsertRow>("tasks", row);
      if (!inserted) {
        return jsonError(
          500,
          "DATABASE_ERROR",
          "Failed to persist generated task.",
        );
      }
      insertedTasks.push(inserted);
    }

    const taskIdByTempId = new Map<string, string>();
    generated.tasks.forEach((task, index) => {
      const inserted = insertedTasks[index];
      if (inserted) {
        taskIdByTempId.set(task.tempId, inserted.id);
      }
    });

    const requiredSkillNames = generated.tasks
      .flatMap((task) =>
        task.requiredSkills.map((skill) => skill.skillName.trim()),
      )
      .filter((name) => name.length > 0);

    const uniqueRequiredSkillNames = [...new Set(requiredSkillNames)].sort();

    const missingSkillNames = uniqueRequiredSkillNames.filter(
      (name) =>
        !existingSkills.some(
          (skill) => skill.name.toLowerCase() === name.toLowerCase(),
        ),
    );

    let createdSkills: SkillRow[] = [];
    if (missingSkillNames.length > 0) {
      createdSkills = await upsertRows<SkillRow, { name: string }>(
        "skills",
        missingSkillNames.map((name) => ({ name })),
        "name",
      );
    }

    const skillByLowerName = new Map(
      [...existingSkills, ...createdSkills].map((skill) => [
        skill.name.toLowerCase(),
        skill,
      ]),
    );

    const taskSkillRows = generated.tasks.flatMap((task) => {
      const taskId = taskIdByTempId.get(task.tempId);
      if (!taskId) {
        return [];
      }

      return task.requiredSkills.flatMap((requiredSkill) => {
        const skill = skillByLowerName.get(
          requiredSkill.skillName.toLowerCase(),
        );
        if (!skill) {
          return [];
        }

        return {
          task_id: taskId,
          skill_id: skill.id,
          weight: requiredSkill.weight,
        };
      });
    });

    const insertedTaskSkills =
      taskSkillRows.length > 0
        ? await insertRows<TaskRequiredSkillRow, Record<string, unknown>>(
            "task_required_skills",
            taskSkillRows,
          )
        : [];

    const taskDependencyRows = dependencyEdges.flatMap((edge) => {
      const taskId = taskIdByTempId.get(edge.taskId);
      const dependsOnTaskId = taskIdByTempId.get(edge.dependsOnTaskId);
      if (!taskId || !dependsOnTaskId) {
        return [];
      }

      return {
        task_id: taskId,
        depends_on_task_id: dependsOnTaskId,
      };
    });

    const insertedDependencies =
      taskDependencyRows.length > 0
        ? await insertRows<TaskDependencyRow, Record<string, unknown>>(
            "task_dependencies",
            taskDependencyRows,
          )
        : [];

    return NextResponse.json({
      tasks: insertedTasks.map(mapTaskRowToDto),
      taskSkills: insertedTaskSkills.map(mapTaskSkillRowToDto),
      taskDependencies: insertedDependencies.map(mapTaskDependencyRowToDto),
      generation: generatedResult.generation,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
