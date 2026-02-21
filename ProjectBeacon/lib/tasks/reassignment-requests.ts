import { z } from "zod";
import { ApiHttpError } from "@/lib/server/errors";
import {
  insertRows,
  selectRows,
  selectSingle,
  updateRows,
} from "@/lib/server/supabase-rest";
import type { TaskRow } from "@/types/planning";

export const createReassignmentRequestSchema = z
  .object({
    requestType: z.enum(["swap", "handoff"]),
    taskId: z.string().uuid(),
    counterpartyTaskId: z.string().uuid().nullable().optional(),
    toUserId: z.string().uuid(),
    reason: z.string().min(5).max(300),
  })
  .superRefine((value, ctx) => {
    if (value.requestType === "swap" && !value.counterpartyTaskId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "counterpartyTaskId is required for swap requests.",
        path: ["counterpartyTaskId"],
      });
    }

    if (value.requestType === "handoff" && value.counterpartyTaskId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "counterpartyTaskId must be null for handoff requests.",
        path: ["counterpartyTaskId"],
      });
    }
  });

export type CreateReassignmentRequestInput = z.infer<
  typeof createReassignmentRequestSchema
>;

export const respondToRequestSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

export type RespondToRequestInput = z.infer<typeof respondToRequestSchema>;

export type TaskReassignmentRequestRow = {
  id: string;
  project_id: string;
  request_type: "swap" | "handoff";
  task_id: string;
  counterparty_task_id: string | null;
  from_user_id: string;
  to_user_id: string;
  reason: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  requested_by_user_id: string;
  responded_by_user_id: string | null;
  created_at: string;
  responded_at: string | null;
};

async function getTaskInProject(
  projectId: string,
  taskId: string,
): Promise<TaskRow | null> {
  return selectSingle<TaskRow>("tasks", {
    select: "*",
    id: `eq.${taskId}`,
    project_id: `eq.${projectId}`,
  });
}

export async function createTaskReassignmentRequest(params: {
  projectId: string;
  requestedByUserId: string;
  input: CreateReassignmentRequestInput;
}): Promise<TaskReassignmentRequestRow> {
  const primaryTask = await getTaskInProject(
    params.projectId,
    params.input.taskId,
  );
  if (!primaryTask) {
    throw new ApiHttpError(
      404,
      "NOT_FOUND",
      "Primary task not found in project.",
    );
  }

  if (!primaryTask.assignee_user_id) {
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Primary task must be assigned before reassignment can be requested.",
    );
  }

  const fromUserId = primaryTask.assignee_user_id;

  if (params.input.requestType === "swap") {
    const counterpartyTask = await getTaskInProject(
      params.projectId,
      params.input.counterpartyTaskId as string,
    );
    if (!counterpartyTask) {
      throw new ApiHttpError(
        404,
        "NOT_FOUND",
        "Counterparty task not found in project.",
      );
    }

    if (!counterpartyTask.assignee_user_id) {
      throw new ApiHttpError(
        400,
        "VALIDATION_ERROR",
        "Counterparty task must be assigned for swap requests.",
      );
    }

    if (counterpartyTask.assignee_user_id !== params.input.toUserId) {
      throw new ApiHttpError(
        400,
        "VALIDATION_ERROR",
        "toUserId must match the current assignee of the counterparty task.",
      );
    }
  }

  if (
    params.input.requestType === "handoff" &&
    fromUserId === params.input.toUserId
  ) {
    throw new ApiHttpError(
      400,
      "VALIDATION_ERROR",
      "Handoff target must be a different user.",
    );
  }

  const inserted = await insertRows<
    TaskReassignmentRequestRow,
    Record<string, unknown>
  >("task_reassignment_requests", {
    project_id: params.projectId,
    request_type: params.input.requestType,
    task_id: params.input.taskId,
    counterparty_task_id:
      params.input.requestType === "swap"
        ? (params.input.counterpartyTaskId ?? null)
        : null,
    from_user_id: fromUserId,
    to_user_id: params.input.toUserId,
    reason: params.input.reason,
    status: "pending",
    requested_by_user_id: params.requestedByUserId,
    responded_by_user_id: null,
    responded_at: null,
  });

  const created = inserted[0];
  if (!created) {
    throw new ApiHttpError(
      500,
      "DATABASE_ERROR",
      "Failed to create reassignment request.",
    );
  }

  return created;
}

export async function respondToTaskReassignmentRequest(params: {
  requestId: string;
  actorUserId: string;
  action: "accept" | "reject";
}): Promise<TaskReassignmentRequestRow> {
  const request = await selectSingle<TaskReassignmentRequestRow>(
    "task_reassignment_requests",
    {
      select: "*",
      id: `eq.${params.requestId}`,
    },
  );

  if (!request) {
    throw new ApiHttpError(404, "NOT_FOUND", "Reassignment request not found.");
  }

  if (request.status !== "pending") {
    throw new ApiHttpError(
      409,
      "INVALID_STATE",
      "Only pending requests can be responded to.",
    );
  }

  if (params.actorUserId !== request.to_user_id) {
    throw new ApiHttpError(
      403,
      "FORBIDDEN",
      "Only the target user can respond to this request.",
    );
  }

  if (params.action === "accept") {
    if (request.request_type === "handoff") {
      await updateRows<TaskRow>(
        "tasks",
        {
          assignee_user_id: request.to_user_id,
        },
        {
          id: `eq.${request.task_id}`,
          project_id: `eq.${request.project_id}`,
        },
      );
    }

    if (request.request_type === "swap") {
      const taskRows = await selectRows<TaskRow>("tasks", {
        select:
          "id,assignee_user_id,project_id,status,title,description,difficulty_points,due_at,created_at,updated_at",
        id: `in.(${request.task_id},${request.counterparty_task_id})`,
        project_id: `eq.${request.project_id}`,
      });

      const primary = taskRows.find((task) => task.id === request.task_id);
      const counterparty = taskRows.find(
        (task) => task.id === request.counterparty_task_id,
      );

      if (
        !primary ||
        !counterparty ||
        !primary.assignee_user_id ||
        !counterparty.assignee_user_id
      ) {
        throw new ApiHttpError(
          409,
          "INVALID_STATE",
          "Swap tasks are invalid or no longer assigned.",
        );
      }

      await updateRows<TaskRow>(
        "tasks",
        {
          assignee_user_id: counterparty.assignee_user_id,
        },
        {
          id: `eq.${primary.id}`,
          project_id: `eq.${request.project_id}`,
        },
      );

      await updateRows<TaskRow>(
        "tasks",
        {
          assignee_user_id: primary.assignee_user_id,
        },
        {
          id: `eq.${counterparty.id}`,
          project_id: `eq.${request.project_id}`,
        },
      );
    }
  }

  const updated = await updateRows<TaskReassignmentRequestRow>(
    "task_reassignment_requests",
    {
      status: params.action === "accept" ? "accepted" : "rejected",
      responded_by_user_id: params.actorUserId,
      responded_at: new Date().toISOString(),
    },
    {
      id: `eq.${params.requestId}`,
      status: "eq.pending",
    },
  );

  const response = updated[0];
  if (!response) {
    throw new ApiHttpError(
      500,
      "DATABASE_ERROR",
      "Failed to update reassignment request status.",
    );
  }

  return response;
}
