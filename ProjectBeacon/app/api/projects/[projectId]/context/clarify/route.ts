import { NextResponse } from "next/server";
import {
  buildClarificationState,
  generateClarificationQuestions,
} from "@/lib/ai/context-confidence";
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

    const questions = await generateClarificationQuestions({
      projectName: access.project.name,
      projectDescription: access.project.description,
      projectDeadline: access.project.deadline,
      contexts,
      askedCount,
      confidence: state.confidence,
      fallbackQuestions: state.questions,
    });

    return NextResponse.json({
      state: {
        confidence: state.confidence,
        threshold: state.threshold,
        askedCount: state.askedCount,
        maxQuestions: state.maxQuestions,
        readyForGeneration: state.readyForGeneration,
      },
      questions,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
