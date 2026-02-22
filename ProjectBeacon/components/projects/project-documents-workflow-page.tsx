"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ContextEditor,
  type PlanningWorkspaceContext,
} from "@/components/projects/context-editor";
import {
  ProjectRecentUploads,
  ProjectUploadDropzone,
  type WorkspaceDocument,
} from "@/components/projects/project-documents-uploader";

type PlanningStatus = "draft" | "locked" | "assigned";

type ProjectDocumentsWorkflowPageProps = {
  projectId: string;
};

type PlanningWorkspaceState = {
  contexts: PlanningWorkspaceContext[];
  documents: WorkspaceDocument[];
  clarification: {
    confidence: number;
    readyForGeneration: boolean;
    askedCount: number;
    maxQuestions: number;
  };
  canGenerate: boolean;
  hasMinimumInput: boolean;
};

const DEFAULT_CLARIFICATION: PlanningWorkspaceState["clarification"] = {
  confidence: 0,
  readyForGeneration: false,
  askedCount: 0,
  maxQuestions: 5,
};

const INITIAL_WORKSPACE_STATE: PlanningWorkspaceState = {
  contexts: [],
  documents: [],
  clarification: DEFAULT_CLARIFICATION,
  canGenerate: false,
  hasMinimumInput: false,
};

function normalizePlanningStatus(value: unknown): PlanningStatus {
  if (value === "locked" || value === "assigned") {
    return value;
  }

  return "draft";
}

function toContextEntries(description: string): PlanningWorkspaceContext[] {
  if (!description.trim()) {
    return [];
  }

  return [
    {
      id: "project-description",
      title: "Project requirements",
      contextType: "initial",
      createdAt: new Date().toISOString(),
    },
  ];
}

function normalizeDocuments(payload: unknown): WorkspaceDocument[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const records = payload as {
    documents?: Array<{
      createdAt?: string;
      fileName?: string;
      id?: string;
    }>;
  };

  if (!Array.isArray(records.documents)) {
    return [];
  }

  return records.documents
    .filter((document) => typeof document.id === "string")
    .map((document) => ({
      id: document.id as string,
      fileName:
        typeof document.fileName === "string"
          ? document.fileName
          : "Unnamed document",
      createdAt:
        typeof document.createdAt === "string"
          ? document.createdAt
          : new Date().toISOString(),
      status: "analyzed" as const,
    }));
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

  if (typeof candidate.error?.message === "string") {
    return candidate.error.message;
  }

  return fallback;
}

function computeHasMinimumInput(args: {
  contextText: string;
  documents: WorkspaceDocument[];
}): boolean {
  if (args.contextText.trim().length > 0) {
    return true;
  }

  return args.documents.some((document) => document.status !== "error");
}

function computeCanGenerate(args: {
  hasMinimumInput: boolean;
  planningStatus: PlanningStatus;
  readyForGeneration: boolean;
}): boolean {
  return (
    args.hasMinimumInput &&
    args.readyForGeneration &&
    args.planningStatus === "draft"
  );
}

function makeTempDocument(fileName: string): WorkspaceDocument {
  return {
    id: `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    fileName,
    createdAt: new Date().toISOString(),
    status: "processing",
  };
}

export function ProjectDocumentsWorkflowPage({
  projectId,
}: ProjectDocumentsWorkflowPageProps) {
  const router = useRouter();
  const [workspaceState, setWorkspaceState] = useState<PlanningWorkspaceState>(
    INITIAL_WORKSPACE_STATE,
  );
  const [planningStatus, setPlanningStatus] = useState<PlanningStatus>("draft");
  const [contextText, setContextText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  const loadWorkspaceState = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setContextError(null);
    setDocumentsError(null);
    setActionError(null);
    setActionStatus(null);

    try {
      const [projectResponse, documentsResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
        fetch(`/api/projects/${projectId}/documents`, { cache: "no-store" }),
      ]);

      const projectPayload = (await projectResponse.json()) as {
        description?: string;
        planningStatus?: string;
      };

      if (!projectResponse.ok) {
        throw new Error(
          resolveMessage(projectPayload, "Failed to load project context."),
        );
      }

      const description =
        typeof projectPayload.description === "string"
          ? projectPayload.description
          : "";
      const contexts = toContextEntries(description);
      const nextPlanningStatus = normalizePlanningStatus(
        projectPayload.planningStatus,
      );

      let documents: WorkspaceDocument[] = [];
      if (documentsResponse.ok) {
        const documentsPayload = (await documentsResponse.json()) as unknown;
        documents = normalizeDocuments(documentsPayload);
      } else {
        const documentsPayload = (await documentsResponse.json()) as unknown;
        setDocumentsError(
          resolveMessage(documentsPayload, "Failed to load documents."),
        );
      }

      const hasMinimumInput = computeHasMinimumInput({
        contextText: description,
        documents,
      });
      const clarification = DEFAULT_CLARIFICATION;

      const canGenerate = computeCanGenerate({
        hasMinimumInput,
        planningStatus: nextPlanningStatus,
        readyForGeneration: clarification.readyForGeneration,
      });

      setContextText(description);
      setPlanningStatus(nextPlanningStatus);
      setWorkspaceState({
        contexts,
        documents,
        clarification: {
          confidence: clarification.confidence,
          readyForGeneration: clarification.readyForGeneration,
          askedCount: clarification.askedCount,
          maxQuestions: clarification.maxQuestions,
        },
        canGenerate,
        hasMinimumInput,
      });
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load workspace.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadWorkspaceState();
  }, [loadWorkspaceState]);

  async function handleSaveContext(nextText: string) {
    setIsSavingContext(true);
    setContextError(null);
    setActionError(null);
    setActionStatus(null);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: nextText,
        }),
      });

      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(resolveMessage(payload, "Failed to save context."));
      }

      const contexts = toContextEntries(nextText);
      setContextText(nextText);
      setWorkspaceState((previous) => {
        const hasMinimumInput = computeHasMinimumInput({
          contextText: nextText,
          documents: previous.documents,
        });
        return {
          ...previous,
          contexts,
          hasMinimumInput,
          canGenerate: computeCanGenerate({
            hasMinimumInput,
            planningStatus,
            readyForGeneration: previous.clarification.readyForGeneration,
          }),
        };
      });
      setActionStatus("Specifications saved.");
    } catch (error) {
      setContextError(
        error instanceof Error ? error.message : "Failed to save context.",
      );
    } finally {
      setIsSavingContext(false);
    }
  }

  async function handleDocumentUpload(file: File) {
    setIsUploadingDocument(true);
    setDocumentsError(null);
    setActionError(null);
    setActionStatus(null);

    const pendingDocument = makeTempDocument(file.name);
    setWorkspaceState((previous) => {
      const documents = [pendingDocument, ...previous.documents];
      const hasMinimumInput = computeHasMinimumInput({
        contextText,
        documents,
      });
      return {
        ...previous,
        documents,
        hasMinimumInput,
        canGenerate: computeCanGenerate({
          hasMinimumInput,
          planningStatus,
          readyForGeneration: previous.clarification.readyForGeneration,
        }),
      };
    });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("usedForPlanning", "true");

      const response = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        throw new Error(
          resolveMessage(payload, "Failed to upload project document."),
        );
      }

      const parsedPayload = payload as {
        document?: {
          createdAt?: string;
          fileName?: string;
          id?: string;
        };
      };

      const document = parsedPayload.document;
      if (!document?.id || !document.fileName) {
        throw new Error("Upload completed but returned invalid document data.");
      }

      setWorkspaceState((previous) => {
        const nextDocuments = previous.documents.map((entry) =>
          entry.id === pendingDocument.id
            ? {
                id: document.id as string,
                fileName: document.fileName as string,
                createdAt: document.createdAt ?? new Date().toISOString(),
                status: "analyzed" as const,
              }
            : entry,
        );
        const hasMinimumInput = computeHasMinimumInput({
          contextText,
          documents: nextDocuments,
        });
        return {
          ...previous,
          documents: nextDocuments,
          hasMinimumInput,
          canGenerate: computeCanGenerate({
            hasMinimumInput,
            planningStatus,
            readyForGeneration: previous.clarification.readyForGeneration,
          }),
        };
      });
      setActionStatus("File uploaded and added to planning inputs.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload document.";
      setDocumentsError(message);
      setWorkspaceState((previous) => ({
        ...previous,
        documents: previous.documents.map((entry) =>
          entry.id === pendingDocument.id
            ? { ...entry, status: "error", errorMessage: message }
            : entry,
        ),
      }));
    } finally {
      setIsUploadingDocument(false);
    }
  }

  const proceedToQuestionsEnabled = useMemo(
    () =>
      planningStatus === "draft" &&
      workspaceState.hasMinimumInput &&
      !isUploadingDocument,
    [isUploadingDocument, planningStatus, workspaceState.hasMinimumInput],
  );

  const proceedHint = useMemo(() => {
    if (planningStatus !== "draft") {
      return "Clarification is only available in draft planning status.";
    }
    if (!workspaceState.hasMinimumInput) {
      return "Upload at least one file or save pasted specs to unlock clarification questions.";
    }
    return "Ready to continue to clarification questions.";
  }, [planningStatus, workspaceState.hasMinimumInput]);

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-[#0d1018] p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-100">
          Upload Project Specs
        </h2>
        <p className="mt-2 text-sm text-slate-400">Loading workspace data...</p>
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800 bg-[#0d1018] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.45)]">
      <div className="space-y-2">
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-100">
          Upload Project Specs
        </h2>
        <p className="max-w-2xl text-base text-slate-400">
          Provide project requirements so AI can break down tasks, estimate
          delivery sequencing, and prepare delegation.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {loadError}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-12 md:auto-rows-[minmax(180px,auto)]">
        <div className="md:col-span-8 md:row-span-2">
          <ProjectUploadDropzone
            onUpload={handleDocumentUpload}
            isUploading={isUploadingDocument}
            error={documentsError}
          />
        </div>

        <div className="md:col-span-4 md:row-span-3">
          <ContextEditor
            contexts={workspaceState.contexts}
            error={contextError}
            initialText={contextText}
            isSaving={isSavingContext}
            onSave={handleSaveContext}
          />
        </div>

        <div className="md:col-span-4 md:row-span-2">
          <ProjectRecentUploads
            documents={workspaceState.documents}
            error={documentsError}
            isLoading={false}
          />
        </div>

        <section className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5 md:col-span-4 md:row-span-1">
          <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-violet-500/20 blur-3xl" />
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
            AI Pro Tip
          </h3>
          <p className="relative mt-2 text-sm leading-6 text-slate-300">
            Technical specs with constraints and deadlines improve task
            decomposition quality and reduce rework during delegation.
          </p>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-[#161821] p-5 md:col-span-8 md:row-span-1">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">
              AI
            </div>
            <div>
              <h4 className="text-base font-semibold text-slate-100">
                Ready to proceed?
              </h4>
              <p className="mt-1 text-xs text-slate-400">{proceedHint}</p>
            </div>
          </div>

          <button
            type="button"
            className="rounded-xl bg-violet-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-800/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300 disabled:shadow-none"
            onClick={() => router.push(`/projects/${projectId}/clarification`)}
            disabled={!proceedToQuestionsEnabled}
          >
            Proceed to Questions
          </button>
        </section>
      </div>

      {actionStatus ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {actionStatus}
        </p>
      ) : null}

      {actionError ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}
