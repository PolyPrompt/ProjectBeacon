import { normalizeProjectRole } from "@/lib/server/project-access";
import {
  mapRouteError,
  requireProjectAccess,
} from "@/lib/server/route-helpers";
import { getWorkflowTimelineView } from "@/lib/workflow/timeline-view";
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
    const access = await requireProjectAccess(request, projectId);
    if (!access.ok) {
      return access.response as NextResponse;
    }

    const role = normalizeProjectRole(access.membership.role);

    const timelineView = await getWorkflowTimelineView(projectId, role);
    return NextResponse.json(timelineView);
  } catch (error) {
    return mapRouteError(error) as NextResponse;
  }
}
