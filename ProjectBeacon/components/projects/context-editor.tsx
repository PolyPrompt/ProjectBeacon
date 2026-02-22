"use client";

import { useEffect, useMemo, useState } from "react";

export type PlanningWorkspaceContext = {
  id: string;
  title: string | null;
  contextType: string;
  createdAt: string;
};

type ContextEditorProps = {
  contexts: PlanningWorkspaceContext[];
  error: string | null;
  initialText: string;
  isSaving: boolean;
  onSave: (value: string) => Promise<void> | void;
};

function formatContextTimestamp(contexts: PlanningWorkspaceContext[]): string {
  if (contexts.length === 0) {
    return "Not saved yet";
  }

  const sorted = [...contexts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latest = sorted[0];
  if (!latest) {
    return "Not saved yet";
  }

  const parsed = new Date(latest.createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return "Saved";
  }

  return `Saved ${parsed.toLocaleString()}`;
}

export function ContextEditor({
  contexts,
  error,
  initialText,
  isSaving,
  onSave,
}: ContextEditorProps) {
  const [draftText, setDraftText] = useState(initialText);
  const trimmedText = draftText.trim();

  useEffect(() => {
    setDraftText(initialText);
  }, [initialText]);

  const canSave = useMemo(
    () => trimmedText.length > 0 && trimmedText !== initialText.trim(),
    [initialText, trimmedText],
  );

  async function handleSave() {
    if (!canSave || isSaving) {
      return;
    }

    await onSave(trimmedText);
  }

  return (
    <section className="flex h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-[#171821] p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-100">
          Paste Specifications
        </h3>
        <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-200">
          {contexts.length > 0 ? "Saved" : "Draft"}
        </span>
      </div>

      <textarea
        className="min-h-[18rem] flex-1 rounded-xl border border-slate-700 bg-[#0f1119] p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
        value={draftText}
        onChange={(event) => setDraftText(event.target.value)}
        placeholder="Paste project requirements, constraints, deadlines, or acceptance criteria."
      />

      <button
        type="button"
        className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleSave}
        disabled={!canSave || isSaving}
      >
        {isSaving ? "Saving specs..." : "Save Specifications"}
      </button>

      <p className="text-xs text-slate-400">
        {formatContextTimestamp(contexts)}
      </p>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
