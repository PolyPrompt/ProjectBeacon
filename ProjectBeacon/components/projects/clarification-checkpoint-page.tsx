"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ClarificationPanel, {
  type ClarificationState,
} from "@/components/projects/clarification-panel";
import type { WorkspaceDocument } from "@/components/projects/project-documents-uploader";

type PlanningStatus = "draft" | "locked" | "assigned";

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

type ClarificationCheckpointPageProps = {
  projectId: string;
};

type PlanningWorkspaceState = {
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

export function ClarificationCheckpointPage({
  projectId,
}: ClarificationCheckpointPageProps) {
  const router = useRouter();
  const [workspaceState, setWorkspaceState] = useState<PlanningWorkspaceState>(
    INITIAL_WORKSPACE_STATE,
  );
  const [planningStatus, setPlanningStatus] = useState<PlanningStatus>("draft");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMetadata, setGenerationMetadata] =
    useState<GenerationMetadata | null>(null);

  const loadWorkspaceState = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setActionError(null);
    setActionStatus(null);
    setGenerationMetadata(null);

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
      const nextPlanningStatus = normalizePlanningStatus(
        projectPayload.planningStatus,
      );

      let documents: WorkspaceDocument[] = [];
      if (documentsResponse.ok) {
        const documentsPayload = (await documentsResponse.json()) as unknown;
        documents = normalizeDocuments(documentsPayload);
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

      setPlanningStatus(nextPlanningStatus);
      setWorkspaceState({
        contexts: [],
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

  async function runGenerate(options?: RunGenerateOptions): Promise<boolean> {
    if (isGenerating) {
      return false;
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
      return false;
    }

    setIsGenerating(true);
    setActionError(null);
    setActionStatus(null);
    setGenerationMetadata(null);

    try {
      const useProvisionalPlanning =
        options?.allowLowConfidenceProceed === true ||
        !workspaceState.clarification.readyForGeneration;
      const response = await fetch(
        `/api/projects/${projectId}/ai/generate-tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            allowLowConfidenceProceed: useProvisionalPlanning,
          }),
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
      return true;
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to generate tasks.",
      );
      return false;
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleProceedFromClarification(
    clarificationState: ClarificationState,
  ) {
    handleClarificationState(clarificationState);
    const generated = await runGenerate({ allowLowConfidenceProceed: true });
    if (generated) {
      router.push(`/projects/${projectId}/inventory`);
    }
  }

  function handleReturnToRefinement() {
    setActionError(null);
    setActionStatus(
      "Returned to refinement. Update specs or constraints, then re-run clarification prompts.",
    );
    router.push(`/projects/${projectId}/workspace`);
  }

  const clarificationDisabled = useMemo(
    () =>
      planningStatus !== "draft" ||
      isGenerating ||
      !workspaceState.hasMinimumInput,
    [isGenerating, planningStatus, workspaceState.hasMinimumInput],
  );

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-[#0d1018] p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-100">
          Clarification Checkpoint
        </h2>
        <p className="mt-2 text-sm text-slate-400">Loading workspace data...</p>
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800 bg-[#0d1018] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.45)]">
      <div className="space-y-2">
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-100">
          Clarification Checkpoint
        </h2>
        <p className="max-w-2xl text-base text-slate-400">
          Answer targeted AI questions before finalizing the task inventory.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {loadError}
        </p>
      ) : null}

      {!workspaceState.hasMinimumInput ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Add context or upload a document before running clarification.
        </p>
      ) : null}

      <ClarificationPanel
        disabled={clarificationDisabled}
        onProceedToDelegation={handleProceedFromClarification}
        onReturnToRefinement={handleReturnToRefinement}
        onStateChange={handleClarificationState}
        projectId={projectId}
      />

      {generationMetadata ? (
        <p className="rounded-lg border border-slate-700 bg-[#11121a] px-3 py-2 text-xs text-slate-300">
          Mode: <span className="font-semibold">{generationMetadata.mode}</span>
          {generationMetadata.mode === "fallback" &&
          generationMetadata.reason ? (
            <> · Reason: {generationMetadata.reason}</>
          ) : null}
          {generationMetadata.diagnostics?.message ? (
            <> · {generationMetadata.diagnostics.message}</>
          ) : null}
        </p>
      ) : null}

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

      <div className="flex justify-between">
        <button
          type="button"
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700/60"
          onClick={() => router.push(`/projects/${projectId}/workspace`)}
        >
          Back to Project Inputs
        </button>
      </div>
    </section>
  );
}
