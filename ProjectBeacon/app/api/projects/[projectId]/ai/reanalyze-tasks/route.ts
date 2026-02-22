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
  requireProjectAccess,
  requireProjectAdmin,
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

type ComparableTask = {
  titleNormalized: string;
  titleTokens: Set<string>;
  descriptionTokens: Set<string>;
};

const MAX_EXISTING_TASK_CONTEXT_CHARS = 12_000;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
]);

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clip(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 16))}\n...[truncated]`;
}

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): Set<string> {
  const normalized = normalizeComparableText(value);
  if (!normalized) {
    return new Set<string>();
  }

  return new Set(
    normalized
      .split(" ")
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  );
}

function tokenOverlap(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  return intersection / Math.min(left.size, right.size);
}

function toComparableTask(task: {
  title: string;
  description: string;
}): ComparableTask {
  return {
    titleNormalized: normalizeComparableText(task.title),
    titleTokens: tokenize(task.title),
    descriptionTokens: tokenize(task.description),
  };
}

function isCoveredByExistingTask(
  candidate: ComparableTask,
  existing: ComparableTask[],
): boolean {
  for (const entry of existing) {
    if (
      candidate.titleNormalized.length > 0 &&
      candidate.titleNormalized === entry.titleNormalized
    ) {
      return true;
    }

    const titleTokenCoverage = tokenOverlap(
      candidate.titleTokens,
      entry.titleTokens,
    );
    if (titleTokenCoverage >= 0.8) {
      return true;
    }

    const descriptionTokenCoverage = tokenOverlap(
      candidate.descriptionTokens,
      entry.descriptionTokens,
    );
    if (
      candidate.descriptionTokens.size >= 8 &&
      descriptionTokenCoverage >= 0.85
    ) {
      return true;
    }
  }

  return false;
}

function buildCurrentTaskContextBlock(tasks: TaskRow[]): {
  contextType: "existing_tasks";
  textContent: string;
} | null {
  if (tasks.length === 0) {
    return null;
  }

  const orderedTasks = [...tasks].sort(
    (left, right) =>
      new Date(left.created_at).getTime() -
      new Date(right.created_at).getTime(),
  );

  const formatted = orderedTasks.map((task, index) =>
    [
      `Task ${index + 1}: ${task.title}`,
      `Status: ${task.status}`,
      `DifficultyPoints: ${task.difficulty_points}`,
      `DueAt: ${task.due_at ?? "none"}`,
      `Description: ${task.description || "No description provided."}`,
    ].join("\n"),
  );

  return {
    contextType: "existing_tasks",
    textContent: clip(
      normalizeWhitespace(formatted.join("\n\n")),
      MAX_EXISTING_TASK_CONTEXT_CHARS,
    ),
  };
}

function normalizeGeneratedTasks(
  generatedTasks: Array<{
    tempId: string;
    title: string;
    description: string;
    difficultyPoints: 1 | 2 | 3 | 5 | 8;
    dueAt: string | null;
    requiredSkills: Array<{
      skillName: string;
      weight: number;
    }>;
    dependsOnTempIds: string[];
  }>,
  existingTasks: TaskRow[],
): {
  acceptedTasks: typeof generatedTasks;
  skippedTasks: Array<{ tempId: string; title: string; reason: string }>;
} {
  const existingComparable = existingTasks.map((task) =>
    toComparableTask(task),
  );
  const acceptedComparable: ComparableTask[] = [];
  const acceptedTasks: typeof generatedTasks = [];
  const skippedTasks: Array<{ tempId: string; title: string; reason: string }> =
    [];

  for (const task of generatedTasks) {
    const comparable = toComparableTask(task);

    if (isCoveredByExistingTask(comparable, existingComparable)) {
      skippedTasks.push({
        tempId: task.tempId,
        title: task.title,
        reason: "covered_by_existing_task",
      });
      continue;
    }

    if (isCoveredByExistingTask(comparable, acceptedComparable)) {
      skippedTasks.push({
        tempId: task.tempId,
        title: task.title,
        reason: "duplicate_generated_candidate",
      });
      continue;
    }

    acceptedTasks.push(task);
    acceptedComparable.push(comparable);
  }

  const acceptedTempIds = new Set(acceptedTasks.map((task) => task.tempId));
  const trimmedDependencies = acceptedTasks.map((task) => ({
    ...task,
    dependsOnTempIds: task.dependsOnTempIds.filter((tempId) =>
      acceptedTempIds.has(tempId),
    ),
  }));

  return {
    acceptedTasks: trimmedDependencies,
    skippedTasks,
  };
}

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

    const adminResponse = requireProjectAdmin(access.membership);
    if (adminResponse) {
      return adminResponse;
    }

    const [contexts, existingSkills, existingTasks] = await Promise.all([
      fetchActiveProjectContexts(projectId),
      selectRows<SkillRow>("skills", {
        select: "id,name",
        order: "name.asc",
      }),
      selectRows<TaskRow>("tasks", {
        select:
          "id,project_id,assignee_user_id,title,description,status,difficulty_points,due_at,created_at,updated_at",
        project_id: `eq.${projectId}`,
        order: "created_at.asc",
      }),
    ]);

    const askedCount = countClarificationEntries(contexts);
    const clarificationState = await buildClarificationState({
      projectName: access.project.name,
      projectDescription: access.project.description,
      projectDeadline: access.project.deadline,
      contexts,
      askedCount,
    });

    if (!clarificationState.readyForGeneration) {
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

    const role = normalizeProjectRole(access.membership.role);
    const documentContextBlocks = await buildPlanningDocumentContextBlocks({
      projectId,
      actorUserId: access.userId,
      role,
    });
    const currentTaskContextBlock = buildCurrentTaskContextBlock(existingTasks);
    const contextBlocks = [
      {
        contextType: "project_description",
        textContent: access.project.description,
      },
      ...contexts.map((entry) => ({
        contextType: entry.context_type,
        textContent: entry.text_content,
      })),
      ...documentContextBlocks,
      ...(currentTaskContextBlock ? [currentTaskContextBlock] : []),
      {
        contextType: "reanalysis_instructions",
        textContent: [
          "Re-analysis mode is active.",
          "Generate only net-new tasks that are not already covered by existing tasks.",
          "Avoid rephrasing or duplicating existing work.",
        ].join(" "),
      },
    ];

    console.info("[reanalyzeTasks] prompt context summary", {
      projectId,
      contextBlocks: contextBlocks.length,
      documentContextBlocks: documentContextBlocks.length,
      existingTaskCount: existingTasks.length,
    });

    const strictMode = process.env.AI_GENERATION_STRICT_MODE !== "false";
    const generatedResult = await generateTaskPlan(
      {
        projectName: access.project.name,
        projectDescription: access.project.description,
        projectDeadline: access.project.deadline,
        contextBlocks,
        availableSkills: existingSkills.map((skill) => skill.name),
      },
      { strictMode },
    );

    const normalized = normalizeGeneratedTasks(
      generatedResult.plan.tasks,
      existingTasks,
    );

    if (normalized.acceptedTasks.length === 0) {
      return NextResponse.json({
        tasks: [],
        taskSkills: [],
        taskDependencies: [],
        insertedCount: 0,
        skippedCount: normalized.skippedTasks.length,
        skippedTaskCandidates: normalized.skippedTasks,
        generation: generatedResult.generation,
      });
    }

    const tempIds = normalized.acceptedTasks.map((task) => task.tempId);
    const dependencyEdges = normalized.acceptedTasks.flatMap((task) =>
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

    const rowsToInsert: TaskInsertRow[] = normalized.acceptedTasks.map(
      (task) => ({
        project_id: projectId,
        assignee_user_id: null,
        title: task.title,
        description: task.description,
        difficulty_points: task.difficultyPoints,
        status: "todo",
        due_at: task.dueAt,
      }),
    );

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
    normalized.acceptedTasks.forEach((task, index) => {
      const inserted = insertedTasks[index];
      if (inserted) {
        taskIdByTempId.set(task.tempId, inserted.id);
      }
    });

    const requiredSkillNames = normalized.acceptedTasks
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

    const taskSkillRows = normalized.acceptedTasks.flatMap((task) => {
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
      insertedCount: insertedTasks.length,
      skippedCount: normalized.skippedTasks.length,
      skippedTaskCandidates: normalized.skippedTasks,
      generation: generatedResult.generation,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
