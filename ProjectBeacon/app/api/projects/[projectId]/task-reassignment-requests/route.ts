import { NextResponse } from "next/server";
import {
  createReassignmentRequestSchema,
  createTaskReassignmentRequest,
} from "@/lib/tasks/reassignment-requests";
import { jsonError } from "@/lib/server/errors";
import {
  mapRouteError,
  parseBody,
  requireProjectAccess,
} from "@/lib/server/route-helpers";
import { selectSingle } from "@/lib/server/supabase-rest";

type ProjectMember = {
  user_id: string;
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

    const body = await request.json();
    const parsedBody = parseBody(createReassignmentRequestSchema, body);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const targetMembership = await selectSingle<ProjectMember>(
      "project_members",
      {
        select: "user_id",
        project_id: `eq.${projectId}`,
        user_id: `eq.${parsedBody.data.toUserId}`,
      },
    );

    if (!targetMembership) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Reassignment target must be a project member.",
      );
    }

    const created = await createTaskReassignmentRequest({
      projectId,
      requestedByUserId: access.userId,
      input: parsedBody.data,
    });

    return NextResponse.json(
      {
        id: created.id,
        status: created.status,
      },
      { status: 201 },
    );
  } catch (error) {
    return mapRouteError(error);
  }
}
