import { NextResponse } from "next/server";
import { z } from "zod";
import { mapTaskRowToDto } from "@/lib/tasks/dto";
import {
  mapRouteError,
  requireProjectAccess,
} from "@/lib/server/route-helpers";
import { jsonError } from "@/lib/server/errors";
import {
  normalizeProjectRole,
  type ProjectRole,
} from "@/lib/server/project-access";
import { selectSingle, updateRows } from "@/lib/server/supabase-rest";
import type { TaskRow, TaskStatus } from "@/types/planning";

type RouteContext = {
  params: Promise<{
    projectId: string;
    taskId: string;
  }>;
};

const updateTaskStatusSchema = z.object({
  status: z.enum(["todo", "in_progress", "blocked", "done"]),
});

const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in_progress", "blocked", "done"],
  in_progress: ["blocked", "done"],
  blocked: ["in_progress", "done"],
  done: [],
};

function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) {
    return true;
  }

  return allowedTransitions[from].includes(to);
}

function canUpdateTaskByRole(
  role: ProjectRole,
  actorUserId: string,
  task: TaskRow,
): boolean {
  if (role === "admin") {
    return true;
  }

  return task.assignee_user_id === actorUserId;
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  try {
    const { projectId, taskId } = await params;
    const access = await requireProjectAccess(request, projectId);
    if (!access.ok) {
      return access.response;
    }

    const body = await request.json();
    const parsed = updateTaskStatusSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(422, "VALIDATION_ERROR", "Invalid request body.", {
        issues: parsed.error.flatten(),
      });
    }

    const task = await selectSingle<TaskRow>("tasks", {
      select:
        "id,project_id,assignee_user_id,title,description,status,difficulty_points,due_at,created_at,updated_at",
      id: `eq.${taskId}`,
      project_id: `eq.${projectId}`,
    });

    if (!task) {
      return jsonError(404, "TASK_NOT_FOUND", "Task was not found.");
    }

    const actorRole = normalizeProjectRole(access.membership.role);
    if (!canUpdateTaskByRole(actorRole, access.userId, task)) {
      return jsonError(
        403,
        "FORBIDDEN",
        "You do not have permission to update this task.",
      );
    }

    const nextStatus = parsed.data.status;
    if (!canTransitionTaskStatus(task.status, nextStatus)) {
      return jsonError(
        409,
        "INVALID_STATE",
        "Invalid task status transition.",
        {
          from: task.status,
          to: nextStatus,
          allowedTo: allowedTransitions[task.status],
        },
      );
    }

    if (task.status === nextStatus) {
      return NextResponse.json({ task: mapTaskRowToDto(task) });
    }

    const [updatedTask] = await updateRows<TaskRow>(
      "tasks",
      {
        status: nextStatus,
      },
      {
        id: `eq.${taskId}`,
        project_id: `eq.${projectId}`,
      },
    );

    if (!updatedTask) {
      return jsonError(404, "TASK_NOT_FOUND", "Task was not found.");
    }

    return NextResponse.json({
      task: mapTaskRowToDto(updatedTask),
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
