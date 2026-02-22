import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAuthenticatedUserId } from "@/lib/server/auth";
import { HttpError, toErrorResponse } from "@/lib/server/errors";
import { requireProjectMembership } from "@/lib/server/project-access";
import { supabaseRestGet, updateRows } from "@/lib/server/supabase-rest";

const taskStatusSchema = z.object({
  status: z.enum(["todo", "in_progress", "blocked", "done"]),
});

type RouteContext = {
  params: Promise<{
    projectId: string;
    taskId: string;
  }>;
};

type TaskRow = {
  id: string;
  project_id: string;
  assignee_user_id: string | null;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  due_at: string | null;
  difficulty_points: 1 | 2 | 3 | 5 | 8;
  updated_at: string;
};

const ALLOWED_TRANSITIONS: Record<TaskRow["status"], TaskRow["status"][]> = {
  todo: ["in_progress", "blocked", "done"],
  in_progress: ["todo", "blocked", "done"],
  blocked: ["in_progress", "done"],
  done: ["in_progress"],
};

async function getTask(projectId: string, taskId: string): Promise<TaskRow> {
  const rows = await supabaseRestGet<TaskRow[]>(
    `tasks?select=id,project_id,assignee_user_id,title,description,status,due_at,difficulty_points,updated_at&id=eq.${encodeURIComponent(taskId)}&project_id=eq.${encodeURIComponent(projectId)}&limit=1`,
  );

  const task = rows.at(0);
  if (!task) {
    throw new HttpError(404, "TASK_NOT_FOUND", "Task was not found.");
  }

  return task;
}

function ensureTransitionAllowed(
  fromStatus: TaskRow["status"],
  toStatus: TaskRow["status"],
) {
  if (fromStatus === toStatus) {
    return;
  }

  if (!ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)) {
    throw new HttpError(
      409,
      "INVALID_STATUS_TRANSITION",
      `Cannot transition task status from ${fromStatus} to ${toStatus}.`,
      {
        fromStatus,
        toStatus,
      },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { projectId, taskId } = await params;
    const userId = requireAuthenticatedUserId(request);
    const membership = await requireProjectMembership(projectId, userId);

    const body = await request.json();
    const parsed = taskStatusSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(422, "VALIDATION_ERROR", "Invalid request payload.", {
        issues: parsed.error.issues,
      });
    }

    const task = await getTask(projectId, taskId);

    const isAdmin = membership.role === "admin";
    const isAssignee = task.assignee_user_id === userId;
    if (!isAdmin && !isAssignee) {
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Only admins or assigned users can update task status.",
      );
    }

    ensureTransitionAllowed(task.status, parsed.data.status);

    const [updatedTask] = await updateRows<TaskRow>(
      "tasks",
      {
        status: parsed.data.status,
      },
      {
        id: `eq.${taskId}`,
        project_id: `eq.${projectId}`,
      },
    );

    if (!updatedTask) {
      throw new HttpError(
        500,
        "DATABASE_ERROR",
        "Task status update did not return an updated row.",
      );
    }

    return NextResponse.json({
      task: {
        id: updatedTask.id,
        projectId: updatedTask.project_id,
        assigneeUserId: updatedTask.assignee_user_id,
        title: updatedTask.title,
        description: updatedTask.description,
        status: updatedTask.status,
        softDeadline: updatedTask.due_at,
        difficultyPoints: updatedTask.difficulty_points,
        updatedAt: updatedTask.updated_at,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
