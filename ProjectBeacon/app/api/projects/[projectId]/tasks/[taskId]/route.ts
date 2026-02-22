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
  type ProjectMemberRow,
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

const updateTaskSchema = z
  .object({
    status: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
    assigneeUserId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.assigneeUserId !== undefined,
    {
      message: "At least one of status or assigneeUserId must be provided.",
      path: ["status"],
    },
  );

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

function isAssignmentChanged(
  currentAssignee: string | null,
  nextAssignee: string | null,
): boolean {
  return currentAssignee !== nextAssignee;
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
    const parsed = updateTaskSchema.safeParse(body);
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
    const payload = parsed.data;
    const nextStatus = payload.status;
    const nextAssigneeUserId = payload.assigneeUserId;

    if (nextStatus !== undefined) {
      if (!canUpdateTaskByRole(actorRole, access.userId, task)) {
        return jsonError(
          403,
          "FORBIDDEN",
          "You do not have permission to update this task status.",
        );
      }

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
    }

    if (nextAssigneeUserId !== undefined && nextAssigneeUserId !== null) {
      const assigneeMembership = await selectSingle<ProjectMemberRow>(
        "project_members",
        {
          select: "id,project_id,user_id,role",
          project_id: `eq.${projectId}`,
          user_id: `eq.${nextAssigneeUserId}`,
        },
      );

      if (!assigneeMembership) {
        return jsonError(
          422,
          "INVALID_ASSIGNEE",
          "Selected assignee is not a member of this project.",
        );
      }
    }

    const statusUnchanged =
      nextStatus === undefined || task.status === nextStatus;
    const assigneeUnchanged =
      nextAssigneeUserId === undefined ||
      !isAssignmentChanged(task.assignee_user_id, nextAssigneeUserId);

    if (statusUnchanged && assigneeUnchanged) {
      return NextResponse.json({ task: mapTaskRowToDto(task) });
    }

    const patch: Partial<{
      status: TaskStatus;
      assignee_user_id: string | null;
    }> = {};

    if (nextStatus !== undefined) {
      patch.status = nextStatus;
    }

    if (nextAssigneeUserId !== undefined) {
      patch.assignee_user_id = nextAssigneeUserId;
    }

    const [updatedTask] = await updateRows<TaskRow>("tasks", patch, {
      id: `eq.${taskId}`,
      project_id: `eq.${projectId}`,
    });

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
