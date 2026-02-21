"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  FALLBACK_STATUSES,
  createContextEntry,
  createLocalDocument,
  useWorkspaceDraft,
} from "@/lib/workspace/draft-store";
import {
  PlanningWorkspaceState,
  ProjectPlanningStatus,
} from "@/types/dashboard";

type WorkspaceContextPageProps = {
  initialClarification: PlanningWorkspaceState["clarification"];
  initialDescription: string;
  initialPlanningStatus: ProjectPlanningStatus;
  projectId: string;
  projectName: string;
};

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

export function WorkspaceContextPage({
  initialClarification,
  initialDescription,
  initialPlanningStatus,
  projectId,
  projectName,
}: WorkspaceContextPageProps) {
  const router = useRouter();
  const { draft, isHydrated, updateDraft } = useWorkspaceDraft({
    initialClarification,
    initialDescription,
    initialPlanningStatus,
    projectId,
  });

  const [isSavingContext, setIsSavingContext] = useState(false);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasMinimumContext = useMemo(
    () =>
      draft.contextText.trim().length > 0 ||
      draft.documents.length > 0 ||
      draft.contexts.length > 0,
    [draft.contextText, draft.contexts.length, draft.documents.length],
  );

  const canEdit = draft.planningStatus === "draft";

  const saveContext = async () => {
    if (!canEdit || draft.contextText.trim().length === 0) {
      return;
    }

    setIsSavingContext(true);
    setMessage(null);
    setErrorMessage(null);

    const contextEntry = createContextEntry("Project requirements", "initial");

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: draft.contextText,
        }),
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        const apiMessage =
          payload?.error?.message ?? "Unable to save context details.";

        if (!FALLBACK_STATUSES.has(response.status)) {
          setErrorMessage(apiMessage);
          return;
        }

        setErrorMessage(apiMessage);
        setMessage("Saved in scaffold mode while project API is unavailable.");
      } else {
        setMessage("Context saved.");
      }

      updateDraft((previous) => {
        const withoutInitial = previous.contexts.filter(
          (item) => item.contextType !== "initial",
        );

        return {
          ...previous,
          contexts: [contextEntry, ...withoutInitial],
        };
      });
    } catch (error) {
      setMessage("Saved in scaffold mode while network access is unavailable.");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to reach project API right now.",
      );

      updateDraft((previous) => {
        const withoutInitial = previous.contexts.filter(
          (item) => item.contextType !== "initial",
        );

        return {
          ...previous,
          contexts: [contextEntry, ...withoutInitial],
        };
      });
    } finally {
      setIsSavingContext(false);
    }
  };

  const uploadDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0 || !canEdit) {
      return;
    }

    setIsUploadingDocuments(true);
    setMessage(null);
    setErrorMessage(null);

    const uploaded: PlanningWorkspaceState["documents"] = [];
    let usedFallback = false;
    let firstError: string | null = null;

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/projects/${projectId}/documents`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const payload = (await response
            .json()
            .catch(() => null)) as ApiErrorPayload | null;
          const apiMessage =
            payload?.error?.message ?? `Unable to upload ${file.name}.`;

          if (!FALLBACK_STATUSES.has(response.status)) {
            firstError ??= apiMessage;
            continue;
          }

          firstError ??= apiMessage;
          usedFallback = true;
          uploaded.push(createLocalDocument(file.name));
          continue;
        }

        const payload = (await response.json()) as {
          document: {
            id: string;
            fileName: string;
            createdAt: string;
          };
        };

        uploaded.push({
          id: payload.document.id,
          fileName: payload.document.fileName,
          createdAt: payload.document.createdAt,
        });
      } catch (error) {
        usedFallback = true;
        uploaded.push(createLocalDocument(file.name));
        firstError ??=
          error instanceof Error
            ? error.message
            : `Unable to upload ${file.name}.`;
      }
    }

    if (uploaded.length > 0) {
      updateDraft((previous) => ({
        ...previous,
        documents: [...uploaded, ...previous.documents],
      }));
    }

    if (usedFallback) {
      setMessage(
        "Some uploads were captured in scaffold mode because the documents API is unavailable.",
      );
    } else if (uploaded.length > 0) {
      setMessage("Documents uploaded.");
    }

    setErrorMessage(firstError);
    setIsUploadingDocuments(false);
    event.target.value = "";
  };

  if (!isHydrated) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-7xl animate-pulse rounded-2xl border border-white/10 bg-[#1a1a1a]/70 p-8">
          Loading workspace...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-6 py-8 text-slate-100 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#2d2638] pb-4">
          <div className="flex items-center gap-3 text-[#8b5cf6]">
            <div className="size-8 rounded-lg bg-[#622faf]/25" />
            <p className="text-lg font-bold">Project Planner AI</p>
          </div>
          <nav className="flex items-center gap-4 text-sm text-slate-400">
            <Link href={`/projects/${projectId}`}>Dashboard</Link>
            <span className="border-b-2 border-[#622faf] pb-1 text-slate-100">
              Upload
            </span>
            <Link href={`/projects/${projectId}/workspace/clarify`}>
              Clarify
            </Link>
            <Link href={`/projects/${projectId}/workspace/review`}>Review</Link>
          </nav>
        </header>

        <section>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
            Upload Project Specs
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-400">
            Provide the project requirements so the AI can break down tasks and
            assign roles. {projectName}
          </p>
        </section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:auto-rows-[minmax(180px,auto)]">
          <div className="relative flex flex-col items-center justify-center rounded-xl border border-[#2d2638] bg-[#1a1a1a] p-8 text-center md:col-span-8 md:row-span-2">
            <div className="pointer-events-none absolute inset-4 rounded-lg border-2 border-dashed border-[#2d2638]" />
            <div className="relative z-10 flex max-w-md flex-col items-center gap-5">
              <div className="size-20 rounded-2xl bg-[#622faf]/15" />
              <div>
                <h3 className="text-3xl font-bold">Drag and drop files</h3>
                <p className="mt-2 text-slate-400">
                  PDF, DOCX, or TXT formats supported
                </p>
              </div>
              <label
                className={`rounded-lg px-8 py-3 font-bold text-white shadow-lg shadow-[#622faf]/20 ${canEdit ? "cursor-pointer bg-[#622faf] hover:bg-[#7444bd]" : "cursor-not-allowed bg-slate-600"}`}
              >
                <input
                  className="hidden"
                  disabled={!canEdit || isUploadingDocuments}
                  multiple
                  onChange={uploadDocuments}
                  type="file"
                />
                {isUploadingDocuments ? "Uploading..." : "Browse Files"}
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-[#2d2638] bg-[#1a1a1a] p-6 md:col-span-4 md:row-span-3">
            <h3 className="text-lg font-bold">Paste Specifications</h3>
            <textarea
              className="min-h-[300px] flex-1 rounded-lg border border-[#2d2638] bg-[#0f0e15] p-4 text-slate-200 outline-none transition focus:border-[#622faf]"
              disabled={!canEdit}
              onChange={(event) =>
                updateDraft((previous) => ({
                  ...previous,
                  contextText: event.target.value,
                }))
              }
              placeholder="Paste requirement details, milestones, and constraints..."
              value={draft.contextText}
            />
            <button
              className="rounded-lg bg-[#622faf] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7444bd] disabled:cursor-not-allowed disabled:bg-slate-600"
              disabled={
                !canEdit ||
                isSavingContext ||
                draft.contextText.trim().length === 0
              }
              onClick={saveContext}
              type="button"
            >
              {isSavingContext ? "Saving..." : "Save Context"}
            </button>
          </div>

          <div className="rounded-xl border border-[#2d2638] bg-[#1a1a1a] p-6 md:col-span-4 md:row-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold">Recent Uploads</h3>
              <span className="text-xs text-[#8b5cf6]">
                {draft.documents.length}
              </span>
            </div>
            {draft.documents.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#2d2638] bg-black/20 p-4 text-sm text-slate-400">
                No documents uploaded yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {draft.documents.map((document) => (
                  <li
                    key={document.id}
                    className="rounded-lg border border-[#2d2638] bg-black/20 px-3 py-2.5"
                  >
                    <p className="truncate text-sm font-medium text-slate-200">
                      {document.fileName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(document.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative rounded-xl border border-[#622faf]/35 bg-[#1a1a1a] p-6 md:col-span-4 md:row-span-1">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#8b5cf6]">
              AI Pro Tip
            </p>
            <p className="text-sm text-slate-300">
              The more detailed your specs, the more accurate the generated
              timeline and task breakdown will be.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#2d2638] bg-[#1a1a1a] p-6 md:col-span-8 md:row-span-1">
            <div>
              <h4 className="font-bold">Ready to proceed?</h4>
              <p className="text-xs text-slate-500">
                Save context, upload docs, then continue to clarification.
              </p>
            </div>
            <button
              className="rounded-xl bg-[#622faf] px-8 py-3 font-bold text-white shadow-lg shadow-[#622faf]/30 transition hover:bg-[#7444bd] disabled:cursor-not-allowed disabled:bg-slate-600"
              disabled={!hasMinimumContext}
              onClick={() =>
                router.push(`/projects/${projectId}/workspace/clarify`)
              }
              type="button"
            >
              Continue to Clarification
            </button>
          </div>
        </div>

        {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
        {errorMessage ? (
          <p className="text-sm text-amber-300">{errorMessage}</p>
        ) : null}
      </div>
    </main>
  );
}
