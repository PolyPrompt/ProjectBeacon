import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/server/auth";
import { mapRouteError, parseBody } from "@/lib/server/route-helpers";
import {
  respondToRequestSchema,
  respondToTaskReassignmentRequest,
} from "@/lib/tasks/reassignment-requests";

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const auth = requireAuthUser(request);
    if (!auth.ok) {
      return auth.response;
    }

    const { requestId } = await context.params;
    const body = await request.json();
    const parsedBody = parseBody(respondToRequestSchema, body);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const updated = await respondToTaskReassignmentRequest({
      requestId,
      actorUserId: auth.user.userId,
      action: parsedBody.data.action,
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
