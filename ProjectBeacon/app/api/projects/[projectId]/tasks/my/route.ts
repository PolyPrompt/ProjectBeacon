import { getMyTasksReadModel } from "@/lib/dashboard/read-model";
import { requireAuthenticatedUserId } from "@/lib/server/auth";
import { toErrorResponse } from "@/lib/server/errors";
import { requireProjectMembership } from "@/lib/server/project-access";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { projectId } = await params;
    const userId = requireAuthenticatedUserId(request);

    await requireProjectMembership(projectId, userId);

    const myTasks = await getMyTasksReadModel(projectId, userId);
    return NextResponse.json({ myTasks });
  } catch (error) {
    return toErrorResponse(error);
  }
}
