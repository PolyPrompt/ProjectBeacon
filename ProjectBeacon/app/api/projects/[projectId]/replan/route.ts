import { z } from "zod";
import { NextResponse } from "next/server";
import {
  assignTasks,
  type TaskSkillRequirement,
} from "@/lib/assignment/assign-tasks";
import {
  loadEffectiveMemberSkills,
  loadProjectMembers,
} from "@/lib/assignment/effective-skills";
import { applyReplanPolicy } from "@/lib/assignment/replan-policy";
import { jsonError } from "@/lib/server/errors";
import {
  mapRouteError,
  parseBody,
  requireOwner,
  requireProjectAccess,
} from "@/lib/server/route-helpers";
import {
  deleteRows,
  insertRows,
  selectRows,
  updateRows,
} from "@/lib/server/supabase-rest";
import { validateDependencyGraph } from "@/lib/tasks/validate-dependency-graph";
import type { TaskRow } from "@/types/planning";

const replanSchema = z
  .object({
    tasks: z.array(
      z
        .object({
          id: z.string().uuid().optional(),
          clientTempId: z.string().min(1).max(60).optional(),
          title: z.string().min(3).max(120),
          description: z.string().min(10).max(1000),
          difficultyPoints: z.union([
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(5),
            z.literal(8),
          ]),
          status: z.enum(["todo", "in_progress", "blocked", "done"]),
          dueAt: z.string().datetime().nullable(),
          assigneeUserId: z.string().uuid().nullable().optional(),
        })
        .superRefine((task, ctx) => {
          if (!task.id && !task.clientTempId) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Either id or clientTempId is required.",
            });
          }
        }),
    ),
    taskSkills: z
      .array(
        z.object({
          taskRef: z.string().min(1),
          skillId: z.string().uuid(),
          weight: z.number().min(1).max(5),
        }),
      )
      .default([]),
    taskDependencies: z
      .array(
        z.object({
          taskRef: z.string().min(1),
          dependsOnTaskRef: z.string().min(1),
        }),
      )
      .default([]),
  })
  .superRefine((value, ctx) => {
    const refs = new Set<string>();
    for (const task of value.tasks) {
      const ref = task.id ?? task.clientTempId;
      if (!ref) {
        continue;
      }
      if (refs.has(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate task reference: ${ref}`,
        });
      }
      refs.add(ref);
    }

    for (const dependency of value.taskDependencies) {
      if (dependency.taskRef === dependency.dependsOnTaskRef) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "taskRef and dependsOnTaskRef cannot be identical.",
        });
      }
    }
  });

type TaskRequiredSkillRow = {
  task_id: string;
  skill_id: string;
  weight: number;
};

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

    const ownerResponse = requireOwner(access.membership);
    if (ownerResponse) {
      return ownerResponse;
    }

    if (access.project.planning_status !== "assigned") {
      return jsonError(
        409,
        "INVALID_STATE",
        "Replanning is only available after assignments have been finalized.",
      );
    }

    const body = await request.json();
    const parsedBody = parseBody(replanSchema, body);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const requestTaskRefs = parsedBody.data.tasks.map(
      (task) => task.id ?? (task.clientTempId as string),
    );
    const requestTaskRefSet = new Set(requestTaskRefs);
    const requestDependencyEdges = parsedBody.data.taskDependencies.map(
      (dependency) => ({
        taskId: dependency.taskRef,
        dependsOnTaskId: dependency.dependsOnTaskRef,
      }),
    );

    const unknownRequestDependency = requestDependencyEdges.find(
      (dependency) =>
        !requestTaskRefSet.has(dependency.taskId) ||
        !requestTaskRefSet.has(dependency.dependsOnTaskId),
    );
    if (unknownRequestDependency) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Replan dependencies must reference tasks present in the request payload.",
        unknownRequestDependency,
      );
    }

    const requestDependencyValidation = validateDependencyGraph(
      [...requestTaskRefSet],
      requestDependencyEdges,
    );
    if (!requestDependencyValidation.ok) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Dependency cycle validation failed during replan.",
        {
          reason: requestDependencyValidation.reason,
          edge: requestDependencyValidation.edge,
        },
      );
    }

    const existingTasks = await selectRows<TaskRow>("tasks", {
      select:
        "id,project_id,assignee_user_id,title,description,status,difficulty_points,due_at,created_at,updated_at",
      project_id: `eq.${projectId}`,
    });

    const policyResult = applyReplanPolicy(
      existingTasks,
      parsedBody.data.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        difficultyPoints: task.difficultyPoints,
        status: task.status,
        dueAt: task.dueAt,
        assigneeUserId: task.assigneeUserId,
      })),
    );

    const existingById = new Map(existingTasks.map((task) => [task.id, task]));

    const upsertWithId = policyResult.upserts.filter((task) => task.id);
    for (const task of upsertWithId) {
      await updateRows<TaskRow>(
        "tasks",
        {
          title: task.title,
          description: task.description,
          difficulty_points: task.difficultyPoints,
          status: task.status,
          due_at: task.dueAt,
          assignee_user_id: task.assigneeUserId,
        },
        {
          id: `eq.${task.id}`,
          project_id: `eq.${projectId}`,
        },
      );
    }

    const newTaskRefs = parsedBody.data.tasks
      .filter((task) => !task.id)
      .map((task) => task.clientTempId as string);

    const insertedNewTasks: TaskRow[] = [];
    const newTaskUpserts = policyResult.upserts.filter((task) => !task.id);
    for (const task of newTaskUpserts) {
      const [inserted] = await insertRows<TaskRow, Record<string, unknown>>(
        "tasks",
        {
          project_id: projectId,
          title: task.title,
          description: task.description,
          difficulty_points: task.difficultyPoints,
          status: task.status,
          due_at: task.dueAt,
          assignee_user_id: task.assigneeUserId,
        },
      );

      if (inserted) {
        insertedNewTasks.push(inserted);
      }
    }

    const taskIdByRef = new Map<string, string>();
    parsedBody.data.tasks.forEach((task) => {
      if (task.id) {
        taskIdByRef.set(task.id, task.id);
      }
    });
    newTaskRefs.forEach((clientTempId, index) => {
      const inserted = insertedNewTasks[index];
      if (inserted) {
        taskIdByRef.set(clientTempId, inserted.id);
      }
    });

    if (policyResult.deletedTaskIds.length > 0) {
      const deleteFilter = `in.(${policyResult.deletedTaskIds.join(",")})`;

      await deleteRows("task_required_skills", {
        task_id: deleteFilter,
      });

      await deleteRows("task_dependencies", {
        task_id: deleteFilter,
      });

      await deleteRows("task_dependencies", {
        depends_on_task_id: deleteFilter,
      });

      await deleteRows("tasks", {
        id: deleteFilter,
        project_id: `eq.${projectId}`,
      });
    }

    const resolvedDependencies: Array<{
      taskId: string;
      dependsOnTaskId: string;
    }> = [];
    for (const dependency of parsedBody.data.taskDependencies) {
      const taskId = taskIdByRef.get(dependency.taskRef);
      const dependsOnTaskId = taskIdByRef.get(dependency.dependsOnTaskRef);
      if (!taskId || !dependsOnTaskId) {
        return jsonError(
          500,
          "INTERNAL_ERROR",
          "Failed to resolve dependency references during replan.",
        );
      }

      resolvedDependencies.push({
        taskId,
        dependsOnTaskId,
      });
    }

    const referencedTaskIds = [...new Set(taskIdByRef.values())];

    if (referencedTaskIds.length > 0) {
      const taskIdFilter = `in.(${referencedTaskIds.join(",")})`;
      await deleteRows("task_required_skills", {
        task_id: taskIdFilter,
      });
      await deleteRows("task_dependencies", {
        task_id: taskIdFilter,
      });
      await deleteRows("task_dependencies", {
        depends_on_task_id: taskIdFilter,
      });
    }

    const skillRowsToInsert: Array<{
      task_id: string;
      skill_id: string;
      weight: number;
    }> = [];
    for (const skill of parsedBody.data.taskSkills) {
      const taskId = taskIdByRef.get(skill.taskRef);
      if (!taskId) {
        return jsonError(
          500,
          "INTERNAL_ERROR",
          "Failed to resolve task skill references during replan.",
        );
      }

      skillRowsToInsert.push({
        task_id: taskId,
        skill_id: skill.skillId,
        weight: skill.weight,
      });
    }

    if (skillRowsToInsert.length > 0) {
      await insertRows("task_required_skills", skillRowsToInsert);
    }

    if (resolvedDependencies.length > 0) {
      await insertRows(
        "task_dependencies",
        resolvedDependencies.map((edge) => ({
          task_id: edge.taskId,
          depends_on_task_id: edge.dependsOnTaskId,
        })),
      );
    }

    const latestTasks = await selectRows<TaskRow>("tasks", {
      select:
        "id,project_id,assignee_user_id,title,description,status,difficulty_points,due_at,created_at,updated_at",
      project_id: `eq.${projectId}`,
    });

    const taskRequirementRows =
      latestTasks.length > 0
        ? await selectRows<TaskRequiredSkillRow>("task_required_skills", {
            select: "task_id,skill_id,weight",
            task_id: `in.(${latestTasks.map((task) => task.id).join(",")})`,
          })
        : [];

    const members = await loadProjectMembers(projectId);
    const effectiveSkills = await loadEffectiveMemberSkills(
      projectId,
      members,
      latestTasks,
    );

    const targetTodoIds = new Set<string>();
    for (const task of parsedBody.data.tasks) {
      if (task.status !== "todo") {
        continue;
      }

      const reference = task.id ?? task.clientTempId;
      const resolvedId = reference ? taskIdByRef.get(reference) : undefined;
      if (resolvedId) {
        targetTodoIds.add(resolvedId);
      }
    }

    const assignmentResult = assignTasks(
      latestTasks
        .filter((task) => targetTodoIds.has(task.id))
        .map((task) => ({
          id: task.id,
          status: task.status,
          difficultyPoints: task.difficulty_points,
          assigneeUserId: task.assignee_user_id,
        })),
      effectiveSkills,
      taskRequirementRows.map((row) => ({
        taskId: row.task_id,
        skillId: row.skill_id,
        weight: row.weight,
      })) as TaskSkillRequirement[],
    );

    for (const assignment of assignmentResult.assignments) {
      const existingTask = existingById.get(assignment.taskId);
      if (existingTask?.status === "in_progress") {
        continue;
      }

      await updateRows<TaskRow>(
        "tasks",
        {
          assignee_user_id: assignment.assigneeUserId,
        },
        {
          id: `eq.${assignment.taskId}`,
          project_id: `eq.${projectId}`,
        },
      );
    }

    return NextResponse.json({
      projectId,
      updatedTasks:
        upsertWithId.length +
        insertedNewTasks.length +
        policyResult.deletedTaskIds.length,
      updatedDependencies: resolvedDependencies.length,
      updatedTaskSkills: skillRowsToInsert.length,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
