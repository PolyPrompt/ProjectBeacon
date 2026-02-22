import { NextResponse } from "next/server";
import { z } from "zod";
import { mapTaskRowToDto } from "@/lib/tasks/dto";
import {
  mapRouteError,
  requireProjectAccess,
} from "@/lib/server/route-helpers";
import { jsonError } from "@/lib/server/errors";
import { insertRows, selectSingle } from "@/lib/server/supabase-rest";
import type { ProjectMemberRow } from "@/lib/server/project-access";
import type { TaskRow } from "@/types/planning";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

type TaskInsertRow = {
  project_id: string;
  assignee_user_id: string | null;
  title: string;
  description: string;
  status: "todo";
  difficulty_points: 1 | 2 | 3 | 5 | 8;
  due_at: string | null;
};

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  assigneeUserId: z.string().uuid().nullable(),
  description: z.string().trim().max(2000).optional(),
  difficultyPoints: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(5),
      z.literal(8),
    ])
    .optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
});

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

    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(422, "VALIDATION_ERROR", "Invalid request body.", {
        issues: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;

    if (payload.assigneeUserId) {
      const assigneeMembership = await selectSingle<ProjectMemberRow>(
        "project_members",
        {
          select: "id,project_id,user_id,role",
          project_id: `eq.${projectId}`,
          user_id: `eq.${payload.assigneeUserId}`,
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

    const [createdTask] = await insertRows<TaskRow, TaskInsertRow>("tasks", {
      project_id: projectId,
      assignee_user_id: payload.assigneeUserId,
      title: payload.title,
      description: payload.description ?? "",
      status: "todo",
      difficulty_points: payload.difficultyPoints ?? 3,
      due_at: payload.dueAt ?? null,
    });

    if (!createdTask) {
      return jsonError(
        500,
        "TASK_CREATE_FAILED",
        "Task could not be created at this time.",
      );
    }

    return NextResponse.json(
      {
        task: mapTaskRowToDto(createdTask),
      },
      { status: 201 },
    );
  } catch (error) {
    return mapRouteError(error);
  }
}
