import { z } from "zod";
import { NextResponse } from "next/server";
import { buildClarificationState } from "@/lib/ai/context-confidence";
import {
  MAX_CLARIFICATION_QUESTIONS,
  CLARIFICATION_CONFIDENCE_THRESHOLD,
} from "@/lib/server/env";
import {
  appendProjectContextEntry,
  countClarificationEntries,
  fetchActiveProjectContexts,
} from "@/lib/ai/context-store";
import {
  mapRouteError,
  parseBody,
  requireProjectAccess,
} from "@/lib/server/route-helpers";
import { jsonError } from "@/lib/server/errors";

const clarifyResponseSchema = z.object({
  question: z.string().min(3).max(200),
  answer: z.string().min(3).max(2000),
});

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
    const parsedBody = parseBody(clarifyResponseSchema, body);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const existingContexts = await fetchActiveProjectContexts(projectId);
    const existingAskedCount = countClarificationEntries(existingContexts);
    if (existingAskedCount >= MAX_CLARIFICATION_QUESTIONS) {
      return jsonError(
        409,
        "INVALID_STATE",
        "Clarification limit reached; no additional answers can be submitted.",
        {
          askedCount: existingAskedCount,
          maxQuestions: MAX_CLARIFICATION_QUESTIONS,
          threshold: CLARIFICATION_CONFIDENCE_THRESHOLD,
        },
      );
    }

    await appendProjectContextEntry({
      projectId,
      createdByUserId: access.userId,
      contextType: "clarification_qa",
      title: parsedBody.data.question,
      textContent: `Q: ${parsedBody.data.question}\nA: ${parsedBody.data.answer}`,
    });

    const contexts = await fetchActiveProjectContexts(projectId);
    const askedCount = countClarificationEntries(contexts);

    const state = await buildClarificationState({
      projectName: access.project.name,
      projectDescription: access.project.description,
      projectDeadline: access.project.deadline,
      contexts,
      askedCount,
    });

    const hasExistingAssumptionEntry = contexts.some(
      (entry) => entry.context_type === "assumption",
    );

    if (
      state.assumptions &&
      state.assumptions.length > 0 &&
      state.readyForGeneration &&
      !hasExistingAssumptionEntry
    ) {
      await appendProjectContextEntry({
        projectId,
        createdByUserId: access.userId,
        contextType: "assumption",
        title: "Planning assumptions",
        textContent: state.assumptions
          .map((assumption, index) => `${index + 1}. ${assumption}`)
          .join("\n"),
      });
    }

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
