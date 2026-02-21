"use client";

import { useMemo, useState } from "react";

type ClarificationPanelProps = {
  projectId: string;
  userIdHeaderValue: string;
};

type ClarificationState = {
  confidence: number;
  threshold: number;
  askedCount: number;
  maxQuestions: number;
  readyForGeneration: boolean;
};

export default function ClarificationPanel({
  projectId,
  userIdHeaderValue,
}: ClarificationPanelProps) {
  const [state, setState] = useState<ClarificationState | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => selectedQuestion.trim().length > 0 && answer.trim().length > 0,
    [answer, selectedQuestion],
  );

  async function fetchQuestions() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/context/clarify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userIdHeaderValue,
          },
        },
      );
      const payload = (await response.json()) as {
        questions?: string[];
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Failed to get clarification questions.",
        );
      }

      const nextQuestions = payload.questions ?? [];
      setQuestions(nextQuestions);
      setSelectedQuestion(nextQuestions[0] ?? "");
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Request failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function recomputeConfidence() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/context/confidence`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userIdHeaderValue,
          },
        },
      );
      const payload = (await response.json()) as ClarificationState & {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Failed to compute confidence.",
        );
      }

      setState(payload);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Request failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/context/clarify-response`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userIdHeaderValue,
          },
          body: JSON.stringify({
            question: selectedQuestion,
            answer,
          }),
        },
      );

      const payload = (await response.json()) as ClarificationState & {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Failed to submit answer.");
      }

      setState(payload);
      setAnswer("");
      await fetchQuestions();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error
          ? unknownError.message
          : "Request failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-neutral-200 p-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-black px-3 py-2 text-sm text-white"
          onClick={recomputeConfidence}
          disabled={loading}
        >
          Compute confidence
        </button>
        <button
          type="button"
          className="rounded border border-black px-3 py-2 text-sm"
          onClick={fetchQuestions}
          disabled={loading}
        >
          Get clarifying questions
        </button>
      </div>

      {state ? (
        <div className="rounded bg-neutral-50 p-3 text-sm">
          Confidence: {state.confidence}% (threshold {state.threshold}%) | Asked{" "}
          {state.askedCount}/{state.maxQuestions} | Ready:{" "}
          {state.readyForGeneration ? "yes" : "no"}
        </div>
      ) : null}

      {questions.length > 0 ? (
        <label className="block text-sm">
          Question
          <select
            className="mt-1 block w-full rounded border border-neutral-300 p-2"
            value={selectedQuestion}
            onChange={(event) => setSelectedQuestion(event.target.value)}
          >
            {questions.map((question) => (
              <option key={question} value={question}>
                {question}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block text-sm">
        Answer
        <textarea
          className="mt-1 block w-full rounded border border-neutral-300 p-2"
          rows={3}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Provide a concrete answer to the selected clarification question"
        />
      </label>

      <button
        type="button"
        className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        onClick={submitAnswer}
        disabled={loading || !canSubmit}
      >
        Submit answer
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
