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

export function ContextEditor({
  contexts,
  error,
  initialText,
  isSaving,
  onSave,
}: ContextEditorProps) {
  const [draftText, setDraftText] = useState(initialText);

  useEffect(() => {
    setDraftText(initialText);
  }, [initialText]);

  const trimmedText = draftText.trim();
  const hasExistingContext = contexts.length > 0;
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
    <section className="space-y-3 rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">1. Project Context</h3>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
          {hasExistingContext ? "Update" : "Add"}
        </span>
      </div>

      {hasExistingContext ? (
        <ul className="space-y-2">
          {contexts.map((context) => (
            <li
              key={context.id}
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700"
            >
              <p className="font-semibold">
                {context.title ?? "Project requirements"}
              </p>
              <p className="mt-1">
                Type: {context.contextType} · Created:{" "}
                {new Date(context.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-600">
          No context entries yet. Add the requirements summary to unlock
          clarification and generation.
        </p>
      )}

      <label className="block text-sm">
        Requirements text
        <textarea
          className="mt-1 block w-full rounded border border-neutral-300 p-2"
          rows={5}
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          placeholder="Describe scope, deliverables, deadlines, and mandatory technologies."
        />
      </label>

      <button
        type="button"
        className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        onClick={handleSave}
        disabled={isSaving || !canSave}
      >
        {isSaving
          ? "Saving..."
          : hasExistingContext
            ? "Update context"
            : "Save context"}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
