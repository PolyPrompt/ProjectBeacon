import { NextResponse } from "next/server";
import { buildClarificationState } from "@/lib/ai/context-confidence";
import {
  countClarificationEntries,
  fetchActiveProjectContexts,
} from "@/lib/ai/context-store";
import {
  mapRouteError,
  requireProjectAccess,
} from "@/lib/server/route-helpers";

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

    const contexts = await fetchActiveProjectContexts(projectId);
    const askedCount = countClarificationEntries(contexts);

    const state = await buildClarificationState({
      projectName: access.project.name,
      projectDescription: access.project.description,
      projectDeadline: access.project.deadline,
      contexts,
      askedCount,
    });

    return NextResponse.json({
      confidence: state.confidence,
      threshold: state.threshold,
      askedCount: state.askedCount,
      maxQuestions: state.maxQuestions,
      readyForGeneration: state.readyForGeneration,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
