"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ClarificationPanel, {
  type ClarificationState,
} from "@/components/projects/clarification-panel";
import {
  ContextEditor,
  type PlanningWorkspaceContext,
} from "@/components/projects/context-editor";
import {
  ProjectRecentUploads,
  ProjectUploadDropzone,
  type WorkspaceDocument,
} from "@/components/projects/project-documents-uploader";
import TaskInventoryBlueprint from "@/components/projects/task-inventory-blueprint";

type PlanningStatus = "draft" | "locked" | "assigned";

export type PlanningWorkspaceState = {
  contexts: Array<{
    id: string;
    title: string | null;
    contextType: string;
    createdAt: string;
  }>;
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

type PlanningWorkspaceProps = {
  projectId: string;
};

type GenerationMetadata = {
  mode: "openai" | "fallback";
  reason: string | null;
  strictMode: boolean;
  diagnostics?: {
    message?: string;
    status?: number;
  };
};

type RunGenerateOptions = {
  allowLowConfidenceProceed?: boolean;
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

function normalizeClarification(payload: unknown): ClarificationState {
  if (!payload || typeof payload !== "object") {
    return {
      ...DEFAULT_CLARIFICATION,
      threshold: 85,
    };
  }

  const candidate = payload as Record<string, unknown>;

  return {
    confidence:
      typeof candidate.confidence === "number"
        ? Math.round(candidate.confidence)
        : DEFAULT_CLARIFICATION.confidence,
    threshold:
      typeof candidate.threshold === "number" ? candidate.threshold : 85,
    askedCount:
      typeof candidate.askedCount === "number"
        ? candidate.askedCount
        : DEFAULT_CLARIFICATION.askedCount,
    maxQuestions:
      typeof candidate.maxQuestions === "number"
        ? candidate.maxQuestions
        : DEFAULT_CLARIFICATION.maxQuestions,
    readyForGeneration:
      typeof candidate.readyForGeneration === "boolean"
        ? candidate.readyForGeneration
        : DEFAULT_CLARIFICATION.readyForGeneration,
  };
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

export default function PlanningWorkspace({
  projectId,
}: PlanningWorkspaceProps) {
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [taskCount, setTaskCount] = useState(0);
  const [assignedCount, setAssignedCount] = useState<number | null>(null);
  const [generationMetadata, setGenerationMetadata] =
    useState<GenerationMetadata | null>(null);
  const intakeSectionRef = useRef<HTMLDivElement | null>(null);
  const reviewSectionRef = useRef<HTMLElement | null>(null);
  const [inventoryRefreshToken, setInventoryRefreshToken] = useState(0);
  const [isDelegatingFromInventory, setIsDelegatingFromInventory] =
    useState(false);
  const [clarificationRefreshToken, setClarificationRefreshToken] = useState(0);

  const canLock = planningStatus === "draft" && taskCount > 0;
  const canAssign = planningStatus === "locked";

  const loadWorkspaceState = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setContextError(null);
    setDocumentsError(null);
    setActionError(null);
    setActionStatus(null);
    setGenerationMetadata(null);

    try {
      const [projectResponse, documentsResponse, boardResponse] =
        await Promise.all([
          fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
          fetch(`/api/projects/${projectId}/documents`, { cache: "no-store" }),
          fetch(`/api/projects/${projectId}/workflow/board`, {
            cache: "no-store",
          }),
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

      let nextTaskCount = 0;
      if (boardResponse.ok) {
        const boardPayload = (await boardResponse.json()) as {
          columns?: Array<{ tasks?: Array<{ id?: string }> }>;
          unassigned?: Array<{ id?: string }>;
        };

        const columnTasks = (boardPayload.columns ?? []).reduce(
          (count, column) =>
            count + (Array.isArray(column.tasks) ? column.tasks.length : 0),
          0,
        );
        const unassignedCount = Array.isArray(boardPayload.unassigned)
          ? boardPayload.unassigned.length
          : 0;

        nextTaskCount = columnTasks + unassignedCount;
      }

      const hasMinimumInput = computeHasMinimumInput({
        contextText: description,
        documents,
      });
      let clarification = {
        ...DEFAULT_CLARIFICATION,
        threshold: 85,
      };

      if (hasMinimumInput) {
        const confidenceResponse = await fetch(
          `/api/projects/${projectId}/context/confidence`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (confidenceResponse.ok) {
          const confidencePayload =
            (await confidenceResponse.json()) as unknown;
          clarification = normalizeClarification(confidencePayload);
        } else {
          const confidencePayload =
            (await confidenceResponse.json()) as unknown;
          setLoadError(
            resolveMessage(
              confidencePayload,
              "Could not compute clarification confidence yet.",
            ),
          );
        }
      }

      const canGenerate = computeCanGenerate({
        hasMinimumInput,
        planningStatus: nextPlanningStatus,
        readyForGeneration: clarification.readyForGeneration,
      });

      setContextText(description);
      setPlanningStatus(nextPlanningStatus);
      setTaskCount(nextTaskCount);
      setAssignedCount(null);
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
      setClarificationRefreshToken((previous) => previous + 1);
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
      setClarificationRefreshToken((previous) => previous + 1);
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

  const handleClarificationState = useCallback(
    (state: ClarificationState) => {
      setWorkspaceState((previous) => ({
        ...previous,
        clarification: {
          confidence: state.confidence,
          readyForGeneration: state.readyForGeneration,
          askedCount: state.askedCount,
          maxQuestions: state.maxQuestions,
        },
        canGenerate: computeCanGenerate({
          hasMinimumInput: previous.hasMinimumInput,
          planningStatus,
          readyForGeneration: state.readyForGeneration,
        }),
      }));
    },
    [planningStatus],
  );

  async function runGenerate(options?: RunGenerateOptions) {
    if (isGenerating) {
      return;
    }

    const readyForGeneration = options?.allowLowConfidenceProceed
      ? true
      : workspaceState.clarification.readyForGeneration;
    const canGenerateNow = computeCanGenerate({
      hasMinimumInput: workspaceState.hasMinimumInput,
      planningStatus,
      readyForGeneration,
    });

    if (!canGenerateNow) {
      setActionError(
        "Inputs are ready. Complete clarification until confidence reaches the target, then start AI breakdown.",
      );
      setActionStatus(null);
      return;
    }

    setIsGenerating(true);
    setActionError(null);
    setActionStatus(null);
    setGenerationMetadata(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/ai/generate-tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const payload = (await response.json()) as {
        error?: { message?: string };
        generation?: {
          diagnostics?: {
            message?: string;
            status?: number;
          };
          mode?: "openai" | "fallback";
          reason?: string | null;
          strictMode?: boolean;
        };
        tasks?: Array<{ id: string }>;
      };
      if (!response.ok) {
        throw new Error(
          resolveMessage(payload, "Failed to generate draft tasks."),
        );
      }

      const generatedCount = Array.isArray(payload.tasks)
        ? payload.tasks.length
        : 0;
      const mode =
        payload.generation?.mode === "openai" ||
        payload.generation?.mode === "fallback"
          ? payload.generation.mode
          : null;

      if (mode) {
        setGenerationMetadata({
          mode,
          reason:
            typeof payload.generation?.reason === "string"
              ? payload.generation.reason
              : null,
          strictMode: payload.generation?.strictMode === true,
          diagnostics: payload.generation?.diagnostics,
        });
      } else {
        setGenerationMetadata(null);
      }

      setTaskCount(generatedCount);
      setInventoryRefreshToken((previous) => previous + 1);
      if (mode === "fallback") {
        const reason =
          typeof payload.generation?.reason === "string"
            ? payload.generation.reason
            : "unknown";
        setActionStatus(
          `Generated ${generatedCount} draft tasks using fallback mode (${reason}).`,
        );
      } else if (mode === "openai") {
        setActionStatus(
          `Generated ${generatedCount} draft tasks using OpenAI.`,
        );
      } else {
        setActionStatus(`Generated ${generatedCount} draft tasks.`);
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to generate tasks.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function runLock(): Promise<PlanningStatus | null> {
    if (!canLock) {
      return null;
    }

    setIsLocking(true);
    setActionError(null);
    setActionStatus(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/planning/lock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const payload = (await response.json()) as {
        error?: { message?: string };
        planningStatus?: string;
      };
      if (!response.ok) {
        throw new Error(resolveMessage(payload, "Failed to lock plan."));
      }

      const nextStatus = normalizePlanningStatus(payload.planningStatus);
      setPlanningStatus(nextStatus);
      setWorkspaceState((previous) => ({
        ...previous,
        canGenerate: computeCanGenerate({
          hasMinimumInput: previous.hasMinimumInput,
          planningStatus: nextStatus,
          readyForGeneration: previous.clarification.readyForGeneration,
        }),
      }));
      setActionStatus("Planning status set to locked.");
      return nextStatus;
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to lock planning.",
      );
      return null;
    } finally {
      setIsLocking(false);
    }
  }

  async function runAssign(force = false): Promise<PlanningStatus | null> {
    if (!canAssign) {
      if (!force) {
        return null;
      }
    }

    setIsAssigning(true);
    setActionError(null);
    setActionStatus(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/assignments/run`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const payload = (await response.json()) as {
        assignedCount?: number;
        error?: { message?: string };
        planningStatus?: string;
      };
      if (!response.ok) {
        throw new Error(resolveMessage(payload, "Failed to run assignment."));
      }

      const nextStatus = normalizePlanningStatus(payload.planningStatus);
      setPlanningStatus(nextStatus);
      setWorkspaceState((previous) => ({
        ...previous,
        canGenerate: computeCanGenerate({
          hasMinimumInput: previous.hasMinimumInput,
          planningStatus: nextStatus,
          readyForGeneration: previous.clarification.readyForGeneration,
        }),
      }));
      setAssignedCount(
        typeof payload.assignedCount === "number" ? payload.assignedCount : 0,
      );
      setActionStatus("Assignments generated for current plan.");
      return nextStatus;
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to assign tasks.",
      );
      return null;
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleProceedFromClarification(
    clarificationState: ClarificationState,
  ) {
    handleClarificationState(clarificationState);
    await runGenerate({ allowLowConfidenceProceed: true });
    reviewSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleReturnToRefinement() {
    setActionError(null);
    setActionStatus(
      "Returned to refinement. Update specs or constraints, then re-run clarification prompts.",
    );
    intakeSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleProceedToDelegationFromInventory() {
    if (isDelegatingFromInventory || isLocking || isAssigning) {
      return;
    }

    setIsDelegatingFromInventory(true);
    setActionError(null);
    setActionStatus(null);

    try {
      if (planningStatus === "draft") {
        const nextStatus = await runLock();
        if (nextStatus === "locked") {
          setActionStatus(
            "Blueprint validated and plan locked. Continue once to run final assignment.",
          );
        }
        return;
      }

      if (planningStatus === "locked") {
        await runAssign(true);
        return;
      }

      setActionStatus("Delegation is already complete for this project.");
    } finally {
      setIsDelegatingFromInventory(false);
    }
  }

  const startActionEnabled = useMemo(
    () =>
      planningStatus === "draft" &&
      workspaceState.hasMinimumInput &&
      !isUploadingDocument,
    [isUploadingDocument, planningStatus, workspaceState.hasMinimumInput],
  );

  const startActionLabel = startActionEnabled
    ? "Start AI Breakdown"
    : "Start AI Delegation";

  const startActionHint = useMemo(() => {
    if (planningStatus !== "draft") {
      return "AI draft generation is only available in draft planning status.";
    }
    if (!workspaceState.hasMinimumInput) {
      return "Upload at least one file or save pasted specs to unlock AI actions.";
    }
    if (!workspaceState.canGenerate) {
      return "Input is ready. Clarification confidence still needs to reach the generation threshold.";
    }
    return "Ready to run AI planning from the uploaded inputs.";
  }, [
    planningStatus,
    workspaceState.canGenerate,
    workspaceState.hasMinimumInput,
  ]);

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

      <div
        ref={intakeSectionRef}
        className="grid gap-4 md:grid-cols-12 md:auto-rows-[minmax(180px,auto)]"
      >
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
              <p className="mt-1 text-xs text-slate-400">{startActionHint}</p>
            </div>
          </div>

          <button
            type="button"
            className="rounded-xl bg-violet-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-800/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300 disabled:shadow-none"
            onClick={() => {
              void runGenerate();
            }}
            disabled={!startActionEnabled || isGenerating}
          >
            {isGenerating ? "Running AI Breakdown..." : startActionLabel}
          </button>
        </section>
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-[#171821] p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
          Clarification Checkpoint
        </h3>
        <ClarificationPanel
          disabled={
            planningStatus !== "draft" ||
            isGenerating ||
            !workspaceState.hasMinimumInput
          }
          refreshToken={clarificationRefreshToken}
          onProceedToDelegation={handleProceedFromClarification}
          onReturnToRefinement={handleReturnToRefinement}
          onStateChange={handleClarificationState}
          projectId={projectId}
        />
      </section>

      <TaskInventoryBlueprint
        isProceeding={isDelegatingFromInventory || isLocking || isAssigning}
        onProceedToDelegation={handleProceedToDelegationFromInventory}
        planningStatus={planningStatus}
        projectId={projectId}
        refreshToken={inventoryRefreshToken}
      />

      <section
        ref={reviewSectionRef}
        className="space-y-3 rounded-2xl border border-slate-800 bg-[#171821] p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
            Delegation Output
          </h3>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/projects/${projectId}/userflow/board`}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700/60"
            >
              Open Board
            </Link>
            <Link
              href={`/projects/${projectId}/userflow/timeline`}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700/60"
            >
              Open Timeline
            </Link>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          {taskCount > 0
            ? `${taskCount} tasks currently loaded in the generated draft set.`
            : "No generated tasks yet. Start with AI breakdown once ready."}
        </p>
        {generationMetadata ? (
          <p className="rounded-lg border border-slate-700 bg-[#11121a] px-3 py-2 text-xs text-slate-300">
            Mode:{" "}
            <span className="font-semibold">{generationMetadata.mode}</span>
            {generationMetadata.mode === "fallback" &&
            generationMetadata.reason ? (
              <> · Reason: {generationMetadata.reason}</>
            ) : null}
            {generationMetadata.diagnostics?.message ? (
              <> · {generationMetadata.diagnostics.message}</>
            ) : null}
          </p>
        ) : null}
        {assignedCount !== null ? (
          <p className="text-xs text-slate-400">
            Assigned {assignedCount} tasks in the latest run.
          </p>
        ) : null}
      </section>

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
