"use client";

import Link from "next/link";
import { useState } from "react";

import {
  FALLBACK_STATUSES,
  useWorkspaceDraft,
} from "@/lib/workspace/draft-store";
import {
  PlanningWorkspaceState,
  ProjectPlanningStatus,
} from "@/types/dashboard";

type WorkspaceLockPageProps = {
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

export function WorkspaceLockPage({
  initialClarification,
  initialDescription,
  initialPlanningStatus,
  projectId,
}: WorkspaceLockPageProps) {
  const { draft, isHydrated, updateDraft } = useWorkspaceDraft({
    initialClarification,
    initialDescription,
    initialPlanningStatus,
    projectId,
  });

  const [isLocking, setIsLocking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lockPlan = async () => {
    if (draft.tasks.length === 0 || draft.planningStatus !== "draft") {
      return;
    }

    setIsLocking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/planning/lock`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        const apiMessage = payload?.error?.message ?? "Unable to lock plan.";

        if (!FALLBACK_STATUSES.has(response.status)) {
          setErrorMessage(apiMessage);
          return;
        }

        updateDraft((previous) => ({
          ...previous,
          planningStatus: "locked",
        }));
        setMessage("Plan locked in scaffold mode while API is unavailable.");
        setErrorMessage(apiMessage);
        return;
      }

      updateDraft((previous) => ({
        ...previous,
        planningStatus: "locked",
      }));
      setMessage("Plan locked.");
    } catch (error) {
      updateDraft((previous) => ({
        ...previous,
        planningStatus: "locked",
      }));
      setMessage("Plan locked in scaffold mode while network is unavailable.");
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to lock plan.",
      );
    } finally {
      setIsLocking(false);
    }
  };

  if (!isHydrated) {
    return (
      <main className="min-h-screen bg-[#0a0911] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-3xl animate-pulse rounded-2xl border border-white/10 bg-white/5 p-8">
          Loading lock step...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0911] bg-[radial-gradient(circle_at_top,#211336_0%,#0a0911_55%)] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-2xl border border-white/10 bg-[#14101e]/80 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Step 5
          </p>
          <h1 className="mt-2 text-4xl font-bold">Lock Planning Blueprint</h1>
          <p className="mt-3 text-slate-400">
            Locking moves project status from{" "}
            <strong className="text-slate-200">draft</strong> to{" "}
            <strong className="text-slate-200">locked</strong> and enables final
            assignment.
          </p>
        </header>

        <section className="rounded-2xl border border-[#622faf]/30 bg-[#18131f]/75 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Status
              </p>
              <p className="mt-1 text-xl font-semibold">
                {draft.planningStatus}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Tasks
              </p>
              <p className="mt-1 text-xl font-semibold">{draft.tasks.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Dependencies
              </p>
              <p className="mt-1 text-xl font-semibold">
                {draft.dependencyEdges.length}
              </p>
            </div>
          </div>

          <button
            className="mt-6 rounded-xl bg-[#622faf] px-6 py-3 font-bold text-white shadow-lg shadow-[#622faf]/25 transition hover:bg-[#7444bd] disabled:cursor-not-allowed disabled:bg-slate-600"
            disabled={
              draft.tasks.length === 0 ||
              draft.planningStatus !== "draft" ||
              isLocking
            }
            onClick={lockPlan}
            type="button"
          >
            {isLocking ? "Locking..." : "Lock Plan"}
          </button>

          {draft.tasks.length === 0 ? (
            <p className="mt-4 text-sm text-amber-300">
              Generate and review tasks before locking.
            </p>
          ) : null}
        </section>

        {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
        {errorMessage ? (
          <p className="text-sm text-amber-300">{errorMessage}</p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold"
            href={`/projects/${projectId}/workspace/review`}
          >
            Back to Review
          </Link>
          <Link
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold"
            href={`/projects/${projectId}/workspace/assign`}
          >
            Continue to Assign
          </Link>
        </div>
      </div>
    </main>
  );
}
