import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/server/errors";
import {
  mapRouteError,
  parseBody,
  requireProjectAccess,
} from "@/lib/server/route-helpers";
import {
  deleteRows,
  insertRows,
  selectRows,
  updateRows,
} from "@/lib/server/supabase-rest";
import type { TaskRow } from "@/types/planning";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

type InventoryPriority = "low" | "medium" | "high";

const syncTaskSchema = z.object({
  id: z.string().uuid().optional(),
  priority: z.enum(["low", "medium", "high"]),
  title: z.string().trim().min(3).max(120),
});

const syncTasksSchema = z
  .object({
    tasks: z.array(syncTaskSchema).default([]),
  })
  .superRefine((value, ctx) => {
    const ids = value.tasks.flatMap((task) => (task.id ? [task.id] : []));
    const idSet = new Set<string>();
    for (const id of ids) {
      if (idSet.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate task id in payload: ${id}`,
          path: ["tasks"],
        });
      }
      idSet.add(id);
    }
  });

function mapPriorityToDifficulty(priority: InventoryPriority): 1 | 2 | 3 | 5 {
  if (priority === "low") {
    return 2;
  }
  if (priority === "high") {
    return 5;
  }
  return 3;
}

function buildInFilter(taskIds: string[]): string {
  return `in.(${taskIds.join(",")})`;
}

export async function POST(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { projectId } = await params;
    const access = await requireProjectAccess(request, projectId);
    if (!access.ok) {
      return access.response;
    }

    if (access.project.planning_status !== "draft") {
      return jsonError(
        409,
        "INVALID_STATE",
        "Task blueprint can only be edited while planning status is draft.",
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "VALIDATION_ERROR", "Invalid JSON body.");
    }

    const parsedBody = parseBody(syncTasksSchema, body);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const existingTasks = await selectRows<TaskRow>("tasks", {
      select:
        "id,project_id,assignee_user_id,title,description,status,difficulty_points,due_at,created_at,updated_at",
      project_id: `eq.${projectId}`,
    });

    const existingById = new Map(existingTasks.map((task) => [task.id, task]));
    const taskIdsInRequest = new Set<string>();

    for (const task of parsedBody.data.tasks) {
      if (!task.id) {
        continue;
      }

      if (!existingById.has(task.id)) {
        return jsonError(
          400,
          "VALIDATION_ERROR",
          "Task payload contains an unknown task id.",
          {
            taskId: task.id,
          },
        );
      }

      taskIdsInRequest.add(task.id);
    }

    const syncedTasks: Array<{ id: string }> = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const task of parsedBody.data.tasks) {
      const title = task.title.trim();
      const difficultyPoints = mapPriorityToDifficulty(task.priority);

      if (task.id) {
        const existing = existingById.get(task.id) as TaskRow;
        if (
          existing.title !== title ||
          existing.difficulty_points !== difficultyPoints
        ) {
          await updateRows<TaskRow>(
            "tasks",
            {
              title,
              difficulty_points: difficultyPoints,
            },
            {
              id: `eq.${task.id}`,
              project_id: `eq.${projectId}`,
            },
          );
          updatedCount += 1;
        }

        syncedTasks.push({ id: task.id });
        continue;
      }

      const [insertedTask] = await insertRows<TaskRow, Record<string, unknown>>(
        "tasks",
        {
          project_id: projectId,
          assignee_user_id: null,
          title,
          description: "",
          status: "todo",
          difficulty_points: difficultyPoints,
          due_at: null,
        },
      );

      if (!insertedTask) {
        return jsonError(
          500,
          "TASK_CREATE_FAILED",
          "Task could not be created at this time.",
        );
      }

      createdCount += 1;
      syncedTasks.push({ id: insertedTask.id });
    }

    const deletedTaskIds = existingTasks
      .filter((task) => !taskIdsInRequest.has(task.id))
      .map((task) => task.id);

    if (deletedTaskIds.length > 0) {
      const deleteFilter = buildInFilter(deletedTaskIds);
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

    return NextResponse.json({
      projectId,
      taskCount: syncedTasks.length,
      syncedTasks,
      createdCount,
      updatedCount,
      deletedCount: deletedTaskIds.length,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
