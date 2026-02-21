"use client";

import { useMemo, useState } from "react";

import { PlanningWorkspaceState } from "@/types/dashboard";

type ContextEditorProps = {
  projectId: string;
  disabled: boolean;
  initialText: string;
  onContextSaved: (
    context: PlanningWorkspaceState["contexts"][number],
    nextText: string,
  ) => void;
};

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

const FALLBACK_STATUSES = new Set([404, 405, 501]);

export function ContextEditor({
  projectId,
  disabled,
  initialText,
  onContextSaved,
}: ContextEditorProps) {
  const [contextText, setContextText] = useState(initialText);
  const [title, setTitle] = useState("Project requirements");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasContext = useMemo(
    () => contextText.trim().length > 0,
    [contextText],
  );

  const saveContext = async () => {
    if (!hasContext || disabled) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);

    const nowIso = new Date().toISOString();

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: contextText,
        }),
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        const message =
          payload?.error?.message ??
          "Unable to save context to project details API.";

        if (FALLBACK_STATUSES.has(response.status)) {
          onContextSaved(
            {
              id: `ctx-local-${nowIso}`,
              title,
              contextType: "initial",
              createdAt: nowIso,
            },
            contextText,
          );
          setMessage("Context saved locally while project API is unavailable.");
          setErrorMessage(message);
          return;
        }

        setErrorMessage(message);
        return;
      }

      onContextSaved(
        {
          id: `ctx-${nowIso}`,
          title,
          contextType: "initial",
          createdAt: nowIso,
        },
        contextText,
      );
      setMessage("Context saved.");
    } catch (error) {
      onContextSaved(
        {
          id: `ctx-local-${nowIso}`,
          title,
          contextType: "initial",
          createdAt: nowIso,
        },
        contextText,
      );
      setMessage("Context saved locally while network is unavailable.");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to reach project details API.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">1. Context</h3>
        <span className="text-xs text-slate-500">Requirement text</span>
      </div>

      <div className="space-y-3">
        <label
          className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
          htmlFor="context-title"
        >
          Title
        </label>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400"
          disabled={disabled || isSaving}
          id="context-title"
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />

        <label
          className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
          htmlFor="context-body"
        >
          Requirement details
        </label>
        <textarea
          className="min-h-36 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 outline-none transition focus:border-sky-400"
          disabled={disabled || isSaving}
          id="context-body"
          onChange={(event) => setContextText(event.target.value)}
          placeholder="Summarize project requirements, milestones, and constraints."
          value={contextText}
        />

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!hasContext || disabled || isSaving}
            onClick={saveContext}
            type="button"
          >
            {isSaving ? "Saving..." : "Save Context"}
          </button>
          {message ? (
            <p className="text-xs text-emerald-700">{message}</p>
          ) : null}
          {errorMessage ? (
            <p className="text-xs text-amber-700">{errorMessage}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
