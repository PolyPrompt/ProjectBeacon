"use client";

import { useMemo, useState } from "react";

import { PlanningWorkspaceState } from "@/types/dashboard";

type ClarificationPanelProps = {
  hasMinimumContext: boolean;
  initialClarification: PlanningWorkspaceState["clarification"];
  projectId: string;
  onClarificationUpdate: (
    nextClarification: PlanningWorkspaceState["clarification"],
  ) => void;
};

type ConfidenceResponse = {
  confidence: number;
  threshold: number;
  askedCount: number;
  maxQuestions: number;
  readyForGeneration: boolean;
};

type ClarifyQuestionsResponse = {
  questions: string[];
};

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

const FALLBACK_STATUSES = new Set([404, 405, 501]);
const MOCK_QUESTIONS = [
  "What are the required final deliverables?",
  "Which technologies are required versus optional?",
  "Are there hard milestones before the final deadline?",
];
const CLARIFICATION_TARGET = 85;

export function ClarificationPanel({
  hasMinimumContext,
  initialClarification,
  projectId,
  onClarificationUpdate,
}: ClarificationPanelProps) {
  const [clarification, setClarification] = useState(initialClarification);
  const [pendingQuestions, setPendingQuestions] = useState<string[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [isCheckingConfidence, setIsCheckingConfidence] = useState(false);
  const [isRequestingQuestions, setIsRequestingQuestions] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const confidenceLabel = useMemo(
    () => `${clarification.confidence}%`,
    [clarification.confidence],
  );

  const applyClarificationState = (nextState: ConfidenceResponse) => {
    const nextClarification: PlanningWorkspaceState["clarification"] = {
      confidence: nextState.confidence,
      readyForGeneration: nextState.readyForGeneration,
      askedCount: nextState.askedCount,
      maxQuestions: nextState.maxQuestions,
    };

    setClarification(nextClarification);
    onClarificationUpdate(nextClarification);
  };

  const applyLocalClarification = (
    askedDelta: number,
    confidenceBoost: number,
  ) => {
    setClarification((previous) => {
      const nextAsked = Math.min(
        previous.maxQuestions,
        previous.askedCount + askedDelta,
      );
      const nextConfidence = Math.min(
        100,
        Math.max(previous.confidence, hasMinimumContext ? 40 : 0) +
          confidenceBoost,
      );
      const nextClarification: PlanningWorkspaceState["clarification"] = {
        confidence: nextConfidence,
        readyForGeneration: nextConfidence >= CLARIFICATION_TARGET,
        askedCount: nextAsked,
        maxQuestions: previous.maxQuestions,
      };

      onClarificationUpdate(nextClarification);
      return nextClarification;
    });
  };

  const advanceQuestionQueue = () => {
    const [, ...remaining] = pendingQuestions;
    setPendingQuestions(remaining);
    setActiveQuestion(remaining[0] ?? null);
    setAnswer("");
  };

  const checkConfidence = async () => {
    if (!hasMinimumContext) {
      return;
    }

    setIsCheckingConfidence(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/context/confidence`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        const message =
          payload?.error?.message ?? "Unable to check context confidence.";

        if (FALLBACK_STATUSES.has(response.status)) {
          applyLocalClarification(0, 12);
          setErrorMessage(message);
          return;
        }

        setErrorMessage(message);
        return;
      }

      const payload = (await response.json()) as ConfidenceResponse;
      applyClarificationState(payload);
    } catch (error) {
      applyLocalClarification(0, 12);
      setErrorMessage(
        error instanceof Error ? error.message : "Confidence check failed.",
      );
    } finally {
      setIsCheckingConfidence(false);
    }
  };

  const requestQuestions = async () => {
    if (!hasMinimumContext) {
      return;
    }

    setIsRequestingQuestions(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/context/clarify`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        const message =
          payload?.error?.message ??
          "Unable to request clarification questions.";

        if (FALLBACK_STATUSES.has(response.status)) {
          setPendingQuestions(MOCK_QUESTIONS);
          setActiveQuestion(MOCK_QUESTIONS[0] ?? null);
          setErrorMessage(message);
          return;
        }

        setErrorMessage(message);
        return;
      }

      const payload = (await response.json()) as ClarifyQuestionsResponse;
      setPendingQuestions(payload.questions);
      setActiveQuestion(payload.questions[0] ?? null);
    } catch (error) {
      setPendingQuestions(MOCK_QUESTIONS);
      setActiveQuestion(MOCK_QUESTIONS[0] ?? null);
      setErrorMessage(
        error instanceof Error ? error.message : "Question request failed.",
      );
    } finally {
      setIsRequestingQuestions(false);
    }
  };

  const submitAnswer = async () => {
    if (!activeQuestion || answer.trim().length === 0) {
      return;
    }

    setIsSubmittingAnswer(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/context/clarify-response`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: activeQuestion,
            answer,
          }),
        },
      );

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        const message =
          payload?.error?.message ?? "Unable to submit clarification answer.";

        if (FALLBACK_STATUSES.has(response.status)) {
          applyLocalClarification(1, 18);
          advanceQuestionQueue();
          setErrorMessage(message);
          return;
        }

        setErrorMessage(message);
        return;
      }

      const payload = (await response.json()) as ConfidenceResponse;
      applyClarificationState(payload);
      advanceQuestionQueue();
    } catch (error) {
      applyLocalClarification(1, 18);
      advanceQuestionQueue();
      setErrorMessage(
        error instanceof Error ? error.message : "Answer submission failed.",
      );
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">3. Clarify</h3>
        <p className="text-xs text-slate-500">
          Questions asked: {clarification.askedCount}/
          {clarification.maxQuestions}
        </p>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          <span>Confidence</span>
          <span>{confidenceLabel}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-sky-500 transition-all"
            style={{
              width: `${Math.max(0, Math.min(100, clarification.confidence))}%`,
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={!hasMinimumContext || isCheckingConfidence}
          onClick={checkConfidence}
          type="button"
        >
          {isCheckingConfidence ? "Checking..." : "Check Confidence"}
        </button>
        <button
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={
            !hasMinimumContext ||
            isRequestingQuestions ||
            clarification.readyForGeneration
          }
          onClick={requestQuestions}
          type="button"
        >
          {isRequestingQuestions ? "Loading..." : "Request Questions"}
        </button>
      </div>

      {activeQuestion ? (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-800">{activeQuestion}</p>
          <textarea
            className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400"
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Type your answer..."
            value={answer}
          />
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={answer.trim().length === 0 || isSubmittingAnswer}
            onClick={submitAnswer}
            type="button"
          >
            {isSubmittingAnswer ? "Submitting..." : "Submit Answer"}
          </button>
        </div>
      ) : null}

      {clarification.readyForGeneration ? (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Clarification target reached. Generation can be enabled.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 text-sm text-amber-700">{errorMessage}</p>
      ) : null}
    </section>
  );
}
