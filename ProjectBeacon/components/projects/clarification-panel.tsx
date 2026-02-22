"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ClarificationPanelProps = {
  disabled?: boolean;
  refreshToken?: number;
  onAnswerSubmitted?: (payload: {
    answer: string;
    question: string;
    state: ClarificationState;
  }) => void;
  onProceedToDelegation?: (state: ClarificationState) => void | Promise<void>;
  onQuestionsChange?: (questions: string[]) => void;
  onReturnToRefinement?: () => void;
  onStateChange?: (state: ClarificationState) => void;
  projectId: string;
};

export type ClarificationState = {
  confidence: number;
  threshold: number;
  askedCount: number;
  maxQuestions: number;
  readyForGeneration: boolean;
};

const FALLBACK_MAX_QUESTIONS = 5;
const FALLBACK_THRESHOLD = 85;

const KEYWORD_SUGGESTIONS: Array<{ pattern: RegExp; suggestions: string[] }> = [
  {
    pattern: /ui|design|component|library/i,
    suggestions: ["Tailwind CSS", "Shadcn/ui", "Material UI", "Ant Design"],
  },
  {
    pattern: /deadline|milestone|timeline|schedule/i,
    suggestions: [
      "Milestones every 2 weeks",
      "Code freeze 1 week before deadline",
      "Final review in sprint 6",
    ],
  },
  {
    pattern: /constraint|must|requirement|security/i,
    suggestions: [
      "Use existing auth provider",
      "WCAG AA accessibility baseline",
      "Deploy on existing CI/CD pipeline",
    ],
  },
];

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function normalizeState(payload: unknown): ClarificationState {
  if (!payload || typeof payload !== "object") {
    return {
      confidence: 0,
      threshold: FALLBACK_THRESHOLD,
      askedCount: 0,
      maxQuestions: FALLBACK_MAX_QUESTIONS,
      readyForGeneration: false,
    };
  }

  const candidate = payload as Record<string, unknown>;

  return {
    confidence:
      typeof candidate.confidence === "number"
        ? Math.round(candidate.confidence)
        : 0,
    threshold:
      typeof candidate.threshold === "number"
        ? Math.round(candidate.threshold)
        : FALLBACK_THRESHOLD,
    askedCount:
      typeof candidate.askedCount === "number"
        ? Math.round(candidate.askedCount)
        : 0,
    maxQuestions:
      typeof candidate.maxQuestions === "number"
        ? Math.round(candidate.maxQuestions)
        : FALLBACK_MAX_QUESTIONS,
    readyForGeneration:
      typeof candidate.readyForGeneration === "boolean"
        ? candidate.readyForGeneration
        : false,
  };
}

function resolveMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const candidate = payload as {
    error?: {
      message?: string;
    };
  };

  return typeof candidate.error?.message === "string"
    ? candidate.error.message
    : fallback;
}

function deriveSuggestions(question: string): string[] {
  const match = KEYWORD_SUGGESTIONS.find((rule) => rule.pattern.test(question));
  return match?.suggestions ?? ["No preference", "Open to recommendations"];
}

export default function ClarificationPanel({
  disabled = false,
  refreshToken,
  onAnswerSubmitted,
  onProceedToDelegation,
  onQuestionsChange,
  onReturnToRefinement,
  onStateChange,
  projectId,
}: ClarificationPanelProps) {
  const [state, setState] = useState<ClarificationState | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingQuestions, setIsRefreshingQuestions] = useState(false);
  const [isProceeding, setIsProceeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const lastRefreshTokenRef = useRef<number | undefined>(refreshToken);

  const canSubmit = useMemo(
    () =>
      selectedQuestion.trim().length > 0 &&
      answer.trim().length > 0 &&
      !disabled &&
      !isSubmitting,
    [answer, disabled, isSubmitting, selectedQuestion],
  );

  const isBusy =
    isBootstrapping || isRefreshingQuestions || isSubmitting || isProceeding;

  const progressState = state ?? {
    confidence: 0,
    threshold: FALLBACK_THRESHOLD,
    askedCount: 0,
    maxQuestions: FALLBACK_MAX_QUESTIONS,
    readyForGeneration: false,
  };

  const confidencePercent = clampPercent(progressState.confidence);
  const targetPercent = clampPercent(progressState.threshold);
  const questionPosition = progressState.readyForGeneration
    ? Math.max(
        1,
        Math.min(progressState.askedCount, progressState.maxQuestions),
      )
    : Math.max(
        1,
        Math.min(progressState.askedCount + 1, progressState.maxQuestions),
      );
  const suggestions = useMemo(
    () => deriveSuggestions(selectedQuestion),
    [selectedQuestion],
  );

  const isLowConfidenceTerminal =
    state !== null &&
    state.readyForGeneration &&
    state.confidence < state.threshold &&
    state.askedCount >= state.maxQuestions;

  const isHighConfidenceReady =
    state !== null &&
    state.readyForGeneration &&
    state.confidence >= state.threshold;

  const showQuestionComposer =
    state !== null && !state.readyForGeneration && questions.length > 0;

  const applyQuestions = useCallback(
    (nextQuestions: string[]) => {
      setQuestions(nextQuestions);
      setSelectedQuestion(nextQuestions[0] ?? "");
      onQuestionsChange?.(nextQuestions);
    },
    [onQuestionsChange],
  );

  const fetchConfidenceState = useCallback(async () => {
    const response = await fetch(
      `/api/projects/${projectId}/context/confidence`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(
        resolveMessage(payload, "Failed to compute clarification confidence."),
      );
    }

    const nextState = normalizeState(payload);
    setState(nextState);
    onStateChange?.(nextState);
    return nextState;
  }, [onStateChange, projectId]);

  const fetchQuestions = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/context/clarify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const payload = (await response.json()) as {
      questions?: string[];
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(
        resolveMessage(payload, "Failed to get clarification questions."),
      );
    }

    applyQuestions(Array.isArray(payload.questions) ? payload.questions : []);
  }, [applyQuestions, projectId]);

  const refreshFlow = useCallback(async () => {
    setIsBootstrapping(true);
    setError(null);
    setStatusMessage(null);
    try {
      const nextState = await fetchConfidenceState();
      if (
        nextState.readyForGeneration ||
        nextState.askedCount >= nextState.maxQuestions
      ) {
        applyQuestions([]);
        return;
      }

      await fetchQuestions();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Request failed.",
      );
    } finally {
      setIsBootstrapping(false);
    }
  }, [applyQuestions, fetchConfidenceState, fetchQuestions]);

  useEffect(() => {
    if (disabled) {
      const idleState: ClarificationState = {
        confidence: 0,
        threshold: FALLBACK_THRESHOLD,
        askedCount: 0,
        maxQuestions: FALLBACK_MAX_QUESTIONS,
        readyForGeneration: false,
      };
      setState(idleState);
      applyQuestions([]);
      onStateChange?.(idleState);
      setError(null);
      setStatusMessage(null);
      setIsBootstrapping(false);
      return;
    }

    void refreshFlow();
  }, [applyQuestions, disabled, onStateChange, refreshFlow]);

  useEffect(() => {
    if (typeof refreshToken !== "number") {
      return;
    }

    if (lastRefreshTokenRef.current === refreshToken) {
      return;
    }

    lastRefreshTokenRef.current = refreshToken;
    if (disabled) {
      return;
    }

    void refreshFlow();
  }, [disabled, refreshFlow, refreshToken]);

  async function refreshQuestionsOnly() {
    if (!state || state.readyForGeneration) {
      return;
    }

    setIsRefreshingQuestions(true);
    setError(null);
    setStatusMessage(null);
    try {
      await fetchQuestions();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Failed to fetch clarification questions.",
      );
    } finally {
      setIsRefreshingQuestions(false);
    }
  }

  async function submitAnswer() {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/context/clarify-response`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            question: selectedQuestion,
            answer,
          }),
        },
      );

      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(resolveMessage(payload, "Failed to submit answer."));
      }

      const nextState = normalizeState(payload);
      setState(nextState);
      onStateChange?.(nextState);
      onAnswerSubmitted?.({
        answer,
        question: selectedQuestion,
        state: nextState,
      });
      setAnswer("");

      if (
        nextState.readyForGeneration ||
        nextState.askedCount >= nextState.maxQuestions
      ) {
        applyQuestions([]);
        setStatusMessage("Clarification sequence completed.");
        return;
      }

      setIsRefreshingQuestions(true);
      await fetchQuestions();
      setStatusMessage("Answer saved. Next question loaded.");
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Request failed.",
      );
    } finally {
      setIsRefreshingQuestions(false);
      setIsSubmitting(false);
    }
  }

  async function handleProceedToDelegation() {
    if (!state || !onProceedToDelegation) {
      return;
    }

    setIsProceeding(true);
    setError(null);
    setStatusMessage(null);
    try {
      await onProceedToDelegation(state);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Failed to continue to delegation.",
      );
    } finally {
      setIsProceeding(false);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-violet-500/20 bg-[#111321] p-5 shadow-[0_24px_60px_rgba(6,8,20,0.45)]">
      <header className="space-y-4 rounded-2xl border border-violet-500/20 bg-[#161a2e] p-4">
        <div className="flex flex-wrap items-end justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          <span>Clarification confidence</span>
          <span className="text-violet-300">
            {progressState.confidence}% / {progressState.threshold}% target
          </span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-violet-950/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400 transition-[width] duration-500"
            style={{ width: `${confidencePercent}%` }}
          />
          <div
            className="absolute inset-y-0 w-px bg-violet-200/60"
            style={{ left: `${targetPercent}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {Array.from({ length: progressState.maxQuestions }).map(
              (_, index) => {
                const isCompleted = index < progressState.askedCount;
                const isCurrent =
                  !progressState.readyForGeneration &&
                  index === progressState.askedCount;

                return (
                  <span
                    key={`clarification-step-${index}`}
                    className={[
                      "h-2.5 w-2.5 rounded-full transition-colors",
                      isCompleted
                        ? "bg-violet-400"
                        : isCurrent
                          ? "bg-violet-400 ring-4 ring-violet-500/20"
                          : "bg-violet-200/20",
                    ].join(" ")}
                  />
                );
              },
            )}
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Question {questionPosition} of {progressState.maxQuestions}
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
        <p className="text-sm leading-6 text-slate-200">
          I analyzed your project context and documents. Answer a few targeted
          questions so the task breakdown is grounded in your delivery
          constraints.
        </p>
      </section>

      {isLowConfidenceTerminal ? (
        <section className="space-y-5 rounded-2xl border border-violet-400/30 bg-[#181329] p-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
              Beaver AI Mascot
            </p>
            <h3 className="text-2xl font-bold tracking-tight text-slate-100">
              I&apos;m still a bit fuzzy on the UI details, but we can start.
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              Some tasks may need manual refinement because confidence did not
              reach the {state.threshold}% target within {state.maxQuestions}{" "}
              questions.
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              className="w-full rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              onClick={handleProceedToDelegation}
              disabled={disabled || isBusy}
            >
              Proceed to Delegation Anyway
            </button>
            <button
              type="button"
              className="w-full rounded-xl border border-slate-600 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:border-slate-500 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onReturnToRefinement}
              disabled={disabled || isBusy}
            >
              Go Back to Refinement
            </button>
          </div>
        </section>
      ) : null}

      {isHighConfidenceReady ? (
        <section className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
          <h3 className="text-lg font-semibold text-emerald-100">
            Confidence target reached.
          </h3>
          <p className="text-sm text-emerald-100/90">
            Context quality is high enough to continue to delegation.
          </p>
          <button
            type="button"
            className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700"
            onClick={handleProceedToDelegation}
            disabled={disabled || isBusy}
          >
            Proceed to Delegation
          </button>
        </section>
      ) : null}

      {showQuestionComposer ? (
        <section className="space-y-4 rounded-2xl border border-violet-400/25 bg-[#171628] p-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
              Beaver AI Mascot
            </p>
            <h3 className="text-2xl font-semibold leading-tight text-slate-100">
              {selectedQuestion}
            </h3>
          </div>

          <label className="block">
            <span className="sr-only">Answer clarification question</span>
            <textarea
              className="h-32 w-full rounded-xl border border-slate-700 bg-[#10162b] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/40"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void submitAnswer();
                }
              }}
              placeholder="Type your answer or select from suggestions below..."
              disabled={disabled || isBusy}
            />
          </label>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Suggested Specs
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  className="rounded-full border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-violet-400 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    setAnswer((existing) =>
                      existing.trim().length > 0
                        ? `${existing.trim()}; ${suggestion}`
                        : suggestion,
                    );
                  }}
                  disabled={disabled || isBusy}
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:border-slate-500 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={refreshQuestionsOnly}
              disabled={disabled || isBusy}
            >
              Refresh Question
            </button>
            <button
              type="button"
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              onClick={submitAnswer}
              disabled={!canSubmit || disabled || isBusy}
            >
              Submit Answer
            </button>
          </div>
        </section>
      ) : null}

      {!showQuestionComposer &&
      !isLowConfidenceTerminal &&
      !isHighConfidenceReady &&
      !isBootstrapping ? (
        <section className="rounded-2xl border border-slate-700 bg-[#171821] p-4">
          <p className="text-sm text-slate-300">
            No clarification prompts available right now. Refresh confidence to
            request new questions.
          </p>
          <button
            type="button"
            className="mt-3 rounded-xl border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 transition hover:border-slate-500 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={refreshFlow}
            disabled={disabled || isBusy}
          >
            Retry Clarification
          </button>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={refreshFlow}
          disabled={disabled || isBusy}
        >
          Recompute Confidence
        </button>
        <button
          type="button"
          className="rounded-xl border border-slate-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={refreshQuestionsOnly}
          disabled={
            disabled || isBusy || state === null || state.readyForGeneration
          }
        >
          Fetch Clarifying Questions
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {statusMessage ? (
        <p className="text-sm text-emerald-300">{statusMessage}</p>
      ) : null}
    </section>
  );
}
