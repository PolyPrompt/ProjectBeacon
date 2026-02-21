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

type WorkspaceAssignPageProps = {
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

export function WorkspaceAssignPage({
  initialClarification,
  initialDescription,
  initialPlanningStatus,
  projectId,
}: WorkspaceAssignPageProps) {
  const { draft, isHydrated, updateDraft } = useWorkspaceDraft({
    initialClarification,
    initialDescription,
    initialPlanningStatus,
    projectId,
  });

  const [isAssigning, setIsAssigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runAssignment = async () => {
    if (
      draft.planningStatus === "assigned" ||
      draft.planningStatus !== "locked"
    ) {
      return;
    }

    setIsAssigning(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/assignments/run`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        const apiMessage =
          payload?.error?.message ?? "Unable to run assignment.";

        if (!FALLBACK_STATUSES.has(response.status)) {
          setErrorMessage(apiMessage);
          return;
        }

        updateDraft((previous) => ({
          ...previous,
          planningStatus: "assigned",
        }));
        setMessage(
          "Assignment completed in scaffold mode while API is unavailable.",
        );
        setErrorMessage(apiMessage);
        return;
      }

      updateDraft((previous) => ({
        ...previous,
        planningStatus: "assigned",
      }));
      setMessage("Final assignment run completed.");
    } catch (error) {
      updateDraft((previous) => ({
        ...previous,
        planningStatus: "assigned",
      }));
      setMessage(
        "Assignment completed in scaffold mode while network is unavailable.",
      );
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to run assignment.",
      );
    } finally {
      setIsAssigning(false);
    }
  };

  if (!isHydrated) {
    return (
      <main className="min-h-screen bg-[#0a0911] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-3xl animate-pulse rounded-2xl border border-white/10 bg-white/5 p-8">
          Loading assignment step...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0911] bg-[radial-gradient(circle_at_top,#211336_0%,#0a0911_55%)] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-2xl border border-white/10 bg-[#14101e]/80 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Step 6
          </p>
          <h1 className="mt-2 text-4xl font-bold">Run Final Assignment</h1>
          <p className="mt-3 text-slate-400">
            Assignment is available only after the plan is locked.
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
                Draft Tasks
              </p>
              <p className="mt-1 text-xl font-semibold">{draft.tasks.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Unassigned
              </p>
              <p className="mt-1 text-xl font-semibold">
                {
                  draft.tasks.filter((task) => task.assigneeUserId === null)
                    .length
                }
              </p>
            </div>
          </div>

          <button
            className="mt-6 rounded-xl bg-[#622faf] px-6 py-3 font-bold text-white shadow-lg shadow-[#622faf]/25 transition hover:bg-[#7444bd] disabled:cursor-not-allowed disabled:bg-slate-600"
            disabled={draft.planningStatus !== "locked" || isAssigning}
            onClick={runAssignment}
            type="button"
          >
            {isAssigning ? "Assigning..." : "Run Final Assignment"}
          </button>

          {draft.planningStatus !== "locked" &&
          draft.planningStatus !== "assigned" ? (
            <p className="mt-4 text-sm text-amber-300">
              Lock the plan before running assignment.
            </p>
          ) : null}

          {draft.planningStatus === "assigned" ? (
            <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              Assignment complete. Project is now in assigned state.
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
            href={`/projects/${projectId}/workspace/lock`}
          >
            Back to Lock
          </Link>
          <Link
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold"
            href={`/projects/${projectId}`}
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
