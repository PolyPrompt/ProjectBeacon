import { requireAuthenticatedUserId } from "@/lib/server/auth";
import { toErrorResponse } from "@/lib/server/errors";
import { requireProjectMembership } from "@/lib/server/project-access";
import { getWorkflowBoardView } from "@/lib/workflow/board-view";
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
    const { role } = await requireProjectMembership(projectId, userId);

    const boardView = await getWorkflowBoardView(projectId, role);
    return NextResponse.json(boardView);
  } catch (error) {
    return toErrorResponse(error);
  }
}
