"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  CLARIFICATION_TARGET,
  FALLBACK_STATUSES,
  MOCK_QUESTIONS,
  useWorkspaceDraft,
} from "@/lib/workspace/draft-store";
import {
  PlanningWorkspaceState,
  ProjectPlanningStatus,
} from "@/types/dashboard";

type WorkspaceClarifyPageProps = {
  initialClarification: PlanningWorkspaceState["clarification"];
  initialDescription: string;
  initialPlanningStatus: ProjectPlanningStatus;
  projectId: string;
  projectLeadName: string;
};

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
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

const SUGGESTED_SPECS = [
  "Tailwind CSS",
  "Shadcn/ui",
  "Material UI",
  "Ant Design",
];

export function WorkspaceClarifyPage({
  initialClarification,
  initialDescription,
  initialPlanningStatus,
  projectId,
  projectLeadName,
}: WorkspaceClarifyPageProps) {
  const router = useRouter();
  const { draft, isHydrated, updateDraft } = useWorkspaceDraft({
    initialClarification,
    initialDescription,
    initialPlanningStatus,
    projectId,
  });

  const [pendingQuestions, setPendingQuestions] = useState<string[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [isCheckingConfidence, setIsCheckingConfidence] = useState(false);
  const [isRequestingQuestions, setIsRequestingQuestions] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasMinimumContext = useMemo(
    () =>
      draft.contextText.trim().length > 0 ||
      draft.contexts.length > 0 ||
      draft.documents.length > 0,
    [draft.contextText, draft.contexts.length, draft.documents.length],
  );

  const displayedQuestionNumber = useMemo(() => {
    if (!activeQuestion) {
      return Math.min(
        draft.clarification.maxQuestions,
        draft.clarification.askedCount,
      );
    }

    return Math.min(
      draft.clarification.maxQuestions,
      draft.clarification.askedCount + 1,
    );
  }, [
    activeQuestion,
    draft.clarification.askedCount,
    draft.clarification.maxQuestions,
  ]);

  const applyClarification = (next: ConfidenceResponse) => {
    updateDraft((previous) => ({
      ...previous,
      clarification: {
        confidence: next.confidence,
        readyForGeneration: next.readyForGeneration,
        askedCount: next.askedCount,
        maxQuestions: next.maxQuestions,
      },
    }));
  };

  const applyLocalClarification = (
    askedDelta: number,
    confidenceBoost: number,
  ) => {
    updateDraft((previous) => {
      const nextAskedCount = Math.min(
        previous.clarification.maxQuestions,
        previous.clarification.askedCount + askedDelta,
      );
      const nextConfidence = Math.min(
        100,
        Math.max(
          previous.clarification.confidence,
          hasMinimumContext ? 40 : 0,
        ) + confidenceBoost,
      );

      return {
        ...previous,
        clarification: {
          ...previous.clarification,
          askedCount: nextAskedCount,
          confidence: nextConfidence,
          readyForGeneration: nextConfidence >= CLARIFICATION_TARGET,
        },
      };
    });
  };

  const advanceQuestion = () => {
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
    setMessage(null);

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
        const apiMessage =
          payload?.error?.message ?? "Unable to check context confidence.";

        if (FALLBACK_STATUSES.has(response.status)) {
          applyLocalClarification(0, 12);
          setMessage("Confidence updated in scaffold mode.");
          setErrorMessage(apiMessage);
          return;
        }

        setErrorMessage(apiMessage);
        return;
      }

      applyClarification((await response.json()) as ConfidenceResponse);
      setMessage("Confidence refreshed.");
    } catch (error) {
      applyLocalClarification(0, 12);
      setMessage("Confidence updated in scaffold mode.");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to check confidence.",
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
    setMessage(null);

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
        const apiMessage =
          payload?.error?.message ??
          "Unable to request clarification questions.";

        if (FALLBACK_STATUSES.has(response.status)) {
          setPendingQuestions(MOCK_QUESTIONS);
          setActiveQuestion(MOCK_QUESTIONS[0] ?? null);
          setMessage("Loaded scaffold clarification prompts.");
          setErrorMessage(apiMessage);
          return;
        }

        setErrorMessage(apiMessage);
        return;
      }

      const payload = (await response.json()) as ClarifyQuestionsResponse;

      setPendingQuestions(payload.questions);
      setActiveQuestion(payload.questions[0] ?? null);
      setMessage("Clarification questions ready.");
    } catch (error) {
      setPendingQuestions(MOCK_QUESTIONS);
      setActiveQuestion(MOCK_QUESTIONS[0] ?? null);
      setMessage("Loaded scaffold clarification prompts.");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to request clarification questions.",
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
    setMessage(null);

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
        const apiMessage =
          payload?.error?.message ?? "Unable to submit your answer.";

        if (FALLBACK_STATUSES.has(response.status)) {
          applyLocalClarification(1, 18);
          advanceQuestion();
          setMessage("Answer captured in scaffold mode.");
          setErrorMessage(apiMessage);
          return;
        }

        setErrorMessage(apiMessage);
        return;
      }

      applyClarification((await response.json()) as ConfidenceResponse);
      advanceQuestion();
      setMessage("Answer submitted.");
    } catch (error) {
      applyLocalClarification(1, 18);
      advanceQuestion();
      setMessage("Answer captured in scaffold mode.");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to submit answer.",
      );
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  if (!isHydrated) {
    return (
      <main className="min-h-screen bg-[#18131f] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-6xl animate-pulse rounded-2xl border border-white/10 bg-white/5 p-8">
          Loading clarification workspace...
        </div>
      </main>
    );
  }

  if (!hasMinimumContext) {
    return (
      <main className="min-h-screen bg-[#18131f] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#622faf]/30 bg-white/5 p-8 text-center">
          <h1 className="text-3xl font-bold">
            Add context before clarification
          </h1>
          <p className="mt-3 text-slate-400">
            Upload documents or save requirement text first, then return here.
          </p>
          <Link
            className="mt-6 inline-flex rounded-xl bg-[#622faf] px-5 py-3 font-semibold text-white"
            href={`/projects/${projectId}/workspace/context`}
          >
            Go to Context + Docs
          </Link>
        </div>
      </main>
    );
  }

  const showLowConfidenceFinalState =
    !draft.clarification.readyForGeneration &&
    draft.clarification.askedCount >= draft.clarification.maxQuestions &&
    !activeQuestion;

  return (
    <main className="flex min-h-screen flex-col bg-[#18131f] text-slate-100">
      <header className="border-b border-[#622faf]/20 px-6 py-4">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-[#622faf]" />
            <p className="text-xl font-bold">Nexus OS</p>
          </div>

          <div className="flex max-w-2xl flex-1 flex-col gap-2">
            <div className="flex justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              <span>Clarification Confidence</span>
              <span className="text-[#8b5cf6]">
                {draft.clarification.confidence}% /{" "}
                <span className="text-slate-500">
                  {CLARIFICATION_TARGET}% target
                </span>
              </span>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-[#622faf]/15">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#622faf] to-[#8b5cf6]"
                style={{
                  width: `${Math.max(0, Math.min(100, draft.clarification.confidence))}%`,
                }}
              />
              <div
                className="absolute inset-y-0 w-px bg-white/40"
                style={{ left: `${CLARIFICATION_TARGET}%` }}
              />
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-400">Project Lead</p>
            <p className="text-sm font-bold">{projectLeadName}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex gap-1.5">
            {Array.from(
              { length: draft.clarification.maxQuestions },
              (_, index) => (
                <span
                  key={index}
                  className={`size-2 rounded-full ${
                    index + 1 === displayedQuestionNumber
                      ? "bg-[#622faf] ring-4 ring-[#622faf]/20"
                      : index < displayedQuestionNumber
                        ? "bg-[#622faf]"
                        : "bg-[#622faf]/30"
                  }`}
                />
              ),
            )}
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Question {Math.max(displayedQuestionNumber, 1)} of{" "}
            {draft.clarification.maxQuestions}
          </span>
        </div>

        <div className="mb-6 w-full rounded-3xl border border-[#622faf]/25 bg-[#622faf]/8 p-6">
          <p className="text-base leading-relaxed text-slate-200">
            I&apos;ve analyzed your uploaded specs. To generate the most
            accurate task list, I need a few more details.
          </p>
        </div>

        {showLowConfidenceFinalState ? (
          <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#8b5cf6]">
              Beaver AI Mascot
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight">
              I&apos;m still a bit fuzzy on the UI details, but we can start.
            </h1>
            <p className="mt-3 text-lg text-slate-400">
              Expect some tasks to need manual refinement as the confidence
              target wasn&apos;t fully met.
            </p>
            <div className="mt-8 flex flex-col gap-4">
              <button
                className="rounded-xl bg-[#622faf] px-8 py-4 text-lg font-bold text-white transition hover:bg-[#7444bd]"
                onClick={() =>
                  router.push(`/projects/${projectId}/workspace/generate`)
                }
                type="button"
              >
                Proceed to Delegation Anyway
              </button>
              <Link
                className="text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-300"
                href={`/projects/${projectId}/workspace/context`}
              >
                Go back to refinement
              </Link>
            </div>
          </div>
        ) : (
          <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#8b5cf6]">
                  Beaver AI Mascot
                </p>
                <h1 className="mt-1 text-3xl font-bold leading-tight">
                  {activeQuestion ??
                    "Check confidence and request clarifying questions to continue."}
                </h1>
              </div>
            </div>

            <div className="space-y-4">
              <textarea
                className="min-h-32 w-full rounded-xl border border-slate-700/50 bg-slate-900/50 p-5 text-lg text-slate-100 outline-none transition focus:border-[#622faf]"
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Type your answer or select from suggestions below..."
                value={answer}
              />

              <div className="flex flex-wrap gap-2">
                {SUGGESTED_SPECS.map((suggestion) => (
                  <button
                    className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#622faf]/60 hover:bg-[#622faf]/10"
                    key={suggestion}
                    onClick={() =>
                      setAnswer(
                        (previous) =>
                          `${previous}${previous ? ", " : ""}${suggestion}`,
                      )
                    }
                    type="button"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-[#8b5cf6] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCheckingConfidence}
                  onClick={checkConfidence}
                  type="button"
                >
                  {isCheckingConfidence ? "Checking..." : "Check Confidence"}
                </button>
                <button
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-[#8b5cf6] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    isRequestingQuestions ||
                    draft.clarification.readyForGeneration
                  }
                  onClick={requestQuestions}
                  type="button"
                >
                  {isRequestingQuestions ? "Loading..." : "Request Questions"}
                </button>
                <button
                  className="rounded-lg bg-[#622faf] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#7444bd] disabled:cursor-not-allowed disabled:bg-slate-600"
                  disabled={
                    !activeQuestion ||
                    answer.trim().length === 0 ||
                    isSubmittingAnswer
                  }
                  onClick={submitAnswer}
                  type="button"
                >
                  {isSubmittingAnswer ? "Submitting..." : "Submit Answer"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold"
            href={`/projects/${projectId}/workspace/context`}
          >
            Back to Context
          </Link>
          <button
            className="rounded-lg bg-[#622faf] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#7444bd] disabled:cursor-not-allowed disabled:bg-slate-600"
            disabled={!draft.canGenerate && !showLowConfidenceFinalState}
            onClick={() =>
              router.push(`/projects/${projectId}/workspace/generate`)
            }
            type="button"
          >
            Continue to Generate
          </button>
        </div>

        {message ? (
          <p className="mt-4 text-sm text-emerald-400">{message}</p>
        ) : null}
        {errorMessage ? (
          <p className="mt-2 text-sm text-amber-300">{errorMessage}</p>
        ) : null}
      </section>

      <footer className="border-t border-[#622faf]/20 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-green-500" /> AI Agent
              Active
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#622faf]" /> Specs
              Parsing
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href={`/projects/${projectId}/workspace/review`}>Review</Link>
            <Link href={`/projects/${projectId}`}>Dashboard</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
