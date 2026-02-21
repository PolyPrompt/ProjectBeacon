"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  FALLBACK_STATUSES,
  GenerateTasksResponse,
  MOCK_DEPENDENCIES,
  MOCK_GENERATED_TASKS,
  toDependencyEdges,
  toProjectTasks,
  useWorkspaceDraft,
} from "@/lib/workspace/draft-store";
import {
  PlanningWorkspaceState,
  ProjectPlanningStatus,
} from "@/types/dashboard";

type WorkspaceGeneratePageProps = {
  initialClarification: PlanningWorkspaceState["clarification"];
  initialDescription: string;
  initialPlanningStatus: ProjectPlanningStatus;
  projectId: string;
};

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

export function WorkspaceGeneratePage({
  initialClarification,
  initialDescription,
  initialPlanningStatus,
  projectId,
}: WorkspaceGeneratePageProps) {
  const router = useRouter();
  const { draft, isHydrated, updateDraft } = useWorkspaceDraft({
    initialClarification,
    initialDescription,
    initialPlanningStatus,
    projectId,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canGenerate = useMemo(
    () =>
      draft.canGenerate ||
      draft.clarification.askedCount >= draft.clarification.maxQuestions,
    [
      draft.canGenerate,
      draft.clarification.askedCount,
      draft.clarification.maxQuestions,
    ],
  );

  const generateDraftTasks = async () => {
    if (!canGenerate) {
      return;
    }

    setIsGenerating(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/ai/generate-tasks`,
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
          "Unable to generate draft tasks right now.";

        if (!FALLBACK_STATUSES.has(response.status)) {
          setErrorMessage(apiMessage);
          return;
        }

        updateDraft((previous) => ({
          ...previous,
          tasks: MOCK_GENERATED_TASKS,
          dependencyEdges: MOCK_DEPENDENCIES,
        }));
        setMessage(
          "Generated scaffold draft because the backend route is unavailable.",
        );
        setErrorMessage(apiMessage);
        return;
      }

      const payload = (await response.json()) as GenerateTasksResponse;

      updateDraft((previous) => ({
        ...previous,
        tasks: toProjectTasks(payload),
        dependencyEdges: toDependencyEdges(payload),
      }));

      setMessage("Draft task inventory generated.");
    } catch (error) {
      updateDraft((previous) => ({
        ...previous,
        tasks: MOCK_GENERATED_TASKS,
        dependencyEdges: MOCK_DEPENDENCIES,
      }));
      setMessage(
        "Generated scaffold draft while network access is unavailable.",
      );
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to generate tasks.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isHydrated) {
    return (
      <main className="min-h-screen bg-[#0a0911] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-4xl animate-pulse rounded-2xl border border-white/10 bg-white/5 p-8">
          Loading generation workspace...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0911] bg-[radial-gradient(circle_at_top,#211336_0%,#0a0911_55%)] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl border border-white/10 bg-[#14101e]/80 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Step 3
          </p>
          <h1 className="mt-2 text-4xl font-bold">
            Generate Draft Task Inventory
          </h1>
          <p className="mt-3 text-slate-400">
            Run AI generation once context and clarification are sufficient. The
            draft remains editable before lock.
          </p>
        </header>

        <section className="rounded-2xl border border-[#622faf]/30 bg-[#18131f]/75 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Confidence
              </p>
              <p className="mt-1 text-xl font-semibold">
                {draft.clarification.confidence}%
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Questions Answered
              </p>
              <p className="mt-1 text-xl font-semibold">
                {draft.clarification.askedCount}/
                {draft.clarification.maxQuestions}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Current Draft Tasks
              </p>
              <p className="mt-1 text-xl font-semibold">{draft.tasks.length}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-xl bg-[#622faf] px-6 py-3 font-bold text-white shadow-lg shadow-[#622faf]/25 transition hover:bg-[#7444bd] disabled:cursor-not-allowed disabled:bg-slate-600"
              disabled={
                !canGenerate || isGenerating || draft.planningStatus !== "draft"
              }
              onClick={generateDraftTasks}
              type="button"
            >
              {isGenerating ? "Generating..." : "Generate Draft"}
            </button>

            <button
              className="rounded-xl border border-slate-600 px-6 py-3 font-semibold text-slate-200 transition hover:border-[#8b5cf6] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={draft.tasks.length === 0}
              onClick={() =>
                router.push(`/projects/${projectId}/workspace/review`)
              }
              type="button"
            >
              Continue to Review
            </button>
          </div>

          {!canGenerate ? (
            <p className="mt-4 text-sm text-amber-300">
              Clarification must be ready before generation. Return to the
              clarify step.
            </p>
          ) : null}

          {draft.tasks.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-white/15 bg-black/20 p-4 text-sm text-slate-400">
              No draft exists yet.
            </p>
          ) : (
            <ul className="mt-6 space-y-2">
              {draft.tasks.map((task) => (
                <li
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200"
                  key={task.id}
                >
                  {task.title} · {task.status} · difficulty{" "}
                  {task.difficultyPoints}
                </li>
              ))}
            </ul>
          )}
        </section>

        {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
        {errorMessage ? (
          <p className="text-sm text-amber-300">{errorMessage}</p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold"
            href={`/projects/${projectId}/workspace/clarify`}
          >
            Back to Clarify
          </Link>
          <Link
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold"
            href={`/projects/${projectId}/workspace/review`}
          >
            Review Board
          </Link>
          <Link
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold"
            href={`/projects/${projectId}`}
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
