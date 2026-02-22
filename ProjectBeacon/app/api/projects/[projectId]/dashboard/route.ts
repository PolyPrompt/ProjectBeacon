import { getDashboardSummary } from "@/lib/dashboard/read-model";
import {
  mapRouteError,
  requireProjectAccess,
} from "@/lib/server/route-helpers";
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

    const summary = await getDashboardSummary(projectId, access.userId);
    return NextResponse.json(summary);
  } catch (error) {
    return mapRouteError(error) as NextResponse;
  }
}
