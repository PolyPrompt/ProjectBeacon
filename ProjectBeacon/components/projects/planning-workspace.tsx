"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import ClarificationPanel, {
  type ClarificationState,
} from "@/components/projects/clarification-panel";
import {
  ContextEditor,
  type PlanningWorkspaceContext,
} from "@/components/projects/context-editor";

type PlanningStatus = "draft" | "locked" | "assigned";

export type PlanningWorkspaceState = {
  contexts: Array<{
    id: string;
    title: string | null;
    contextType: string;
    createdAt: string;
  }>;
  documents: Array<{ id: string; fileName: string; createdAt: string }>;
  clarification: {
    confidence: number;
    readyForGeneration: boolean;
    askedCount: number;
    maxQuestions: number;
  };
  canGenerate: boolean;
};

type PlanningWorkspaceProps = {
  projectId: string;
  userIdHeaderValue: string;
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

function normalizeDocuments(
  payload: unknown,
): PlanningWorkspaceState["documents"] {
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

function computeCanGenerate(args: {
  contextText: string;
  documentsLength: number;
  planningStatus: PlanningStatus;
  readyForGeneration: boolean;
}): boolean {
  const hasMinimumContext =
    args.contextText.trim().length > 0 || args.documentsLength > 0;

  return (
    hasMinimumContext &&
    args.readyForGeneration &&
    args.planningStatus === "draft"
  );
}

export default function PlanningWorkspace({
  projectId,
  userIdHeaderValue,
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

  const requiresLocalUserHeader = userIdHeaderValue.trim().length === 0;
  const canLock = planningStatus === "draft" && taskCount > 0;
  const canAssign = planningStatus === "locked";

  const loadWorkspaceState = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setContextError(null);
    setDocumentsError(null);
    setActionError(null);
    setActionStatus(null);

    try {
      const headers = requiresLocalUserHeader
        ? undefined
        : {
            "Content-Type": "application/json",
            "x-user-id": userIdHeaderValue,
          };

      const [
        projectResponse,
        documentsResponse,
        confidenceResponse,
        boardResponse,
      ] = await Promise.all([
        fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
        fetch(`/api/projects/${projectId}/documents`, { cache: "no-store" }),
        headers
          ? fetch(`/api/projects/${projectId}/context/confidence`, {
              method: "POST",
              headers,
            })
          : Promise.resolve(null),
        headers
          ? fetch(`/api/projects/${projectId}/workflow/board`, {
              headers,
              cache: "no-store",
            })
          : Promise.resolve(null),
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

      let documents = INITIAL_WORKSPACE_STATE.documents;
      if (documentsResponse.ok) {
        const documentsPayload = (await documentsResponse.json()) as unknown;
        documents = normalizeDocuments(documentsPayload);
      } else {
        const documentsPayload = (await documentsResponse.json()) as unknown;
        setDocumentsError(
          resolveMessage(documentsPayload, "Failed to load documents."),
        );
      }

      let clarification = {
        ...DEFAULT_CLARIFICATION,
        threshold: 85,
      };
      if (confidenceResponse) {
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

      let nextTaskCount = 0;
      if (boardResponse?.ok) {
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

      const canGenerate = computeCanGenerate({
        contextText: description,
        documentsLength: documents.length,
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
      });
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load workspace.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId, requiresLocalUserHeader, userIdHeaderValue]);

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
      const canGenerate = computeCanGenerate({
        contextText: nextText,
        documentsLength: workspaceState.documents.length,
        planningStatus,
        readyForGeneration: workspaceState.clarification.readyForGeneration,
      });

      setContextText(nextText);
      setWorkspaceState((previous) => ({
        ...previous,
        contexts,
        canGenerate,
      }));
      setActionStatus("Project context saved.");
    } catch (error) {
      setContextError(
        error instanceof Error ? error.message : "Failed to save context.",
      );
    } finally {
      setIsSavingContext(false);
    }
  }

  async function handleDocumentUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploadingDocument(true);
    setDocumentsError(null);
    setActionError(null);
    setActionStatus(null);

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

      const nextDocuments = [
        ...workspaceState.documents.filter((entry) => entry.id !== document.id),
        {
          id: document.id,
          fileName: document.fileName,
          createdAt: document.createdAt ?? new Date().toISOString(),
        },
      ];

      const canGenerate = computeCanGenerate({
        contextText,
        documentsLength: nextDocuments.length,
        planningStatus,
        readyForGeneration: workspaceState.clarification.readyForGeneration,
      });

      setWorkspaceState((previous) => ({
        ...previous,
        documents: nextDocuments,
        canGenerate,
      }));
      setActionStatus("Document uploaded for planning.");
    } catch (error) {
      setDocumentsError(
        error instanceof Error ? error.message : "Failed to upload document.",
      );
    } finally {
      setIsUploadingDocument(false);
      event.target.value = "";
    }
  }

  function handleClarificationState(state: ClarificationState) {
    const canGenerate = computeCanGenerate({
      contextText,
      documentsLength: workspaceState.documents.length,
      planningStatus,
      readyForGeneration: state.readyForGeneration,
    });

    setWorkspaceState((previous) => ({
      ...previous,
      clarification: {
        confidence: state.confidence,
        readyForGeneration: state.readyForGeneration,
        askedCount: state.askedCount,
        maxQuestions: state.maxQuestions,
      },
      canGenerate,
    }));
  }

  async function runGenerate() {
    if (!workspaceState.canGenerate || requiresLocalUserHeader) {
      return;
    }

    setIsGenerating(true);
    setActionError(null);
    setActionStatus(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/ai/generate-tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userIdHeaderValue,
          },
        },
      );

      const payload = (await response.json()) as {
        error?: { message?: string };
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
      setTaskCount(generatedCount);
      setActionStatus(`Generated ${generatedCount} draft tasks.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to generate tasks.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function runLock() {
    if (!canLock || requiresLocalUserHeader) {
      return;
    }

    setIsLocking(true);
    setActionError(null);
    setActionStatus(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/planning/lock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userIdHeaderValue,
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
          contextText,
          documentsLength: previous.documents.length,
          planningStatus: nextStatus,
          readyForGeneration: previous.clarification.readyForGeneration,
        }),
      }));
      setActionStatus("Planning status set to locked.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to lock planning.",
      );
    } finally {
      setIsLocking(false);
    }
  }

  async function runAssign() {
    if (!canAssign || requiresLocalUserHeader) {
      return;
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
            "x-user-id": userIdHeaderValue,
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
          contextText,
          documentsLength: previous.documents.length,
          planningStatus: nextStatus,
          readyForGeneration: previous.clarification.readyForGeneration,
        }),
      }));
      setAssignedCount(
        typeof payload.assignedCount === "number" ? payload.assignedCount : 0,
      );
      setActionStatus("Assignments generated for current plan.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to assign tasks.",
      );
    } finally {
      setIsAssigning(false);
    }
  }

  const canGenerateMessage = useMemo(() => {
    if (requiresLocalUserHeader) {
      return "Local project session missing. Clarification and generation actions are disabled.";
    }
    if (workspaceState.canGenerate) {
      return "Ready to generate draft tasks.";
    }
    if (planningStatus !== "draft") {
      return "Generation is disabled in non-draft planning states.";
    }
    if (
      contextText.trim().length === 0 &&
      workspaceState.documents.length === 0
    ) {
      return "Add context text or upload at least one planning document.";
    }
    if (!workspaceState.clarification.readyForGeneration) {
      return "Run clarification until confidence is ready for generation.";
    }
    return "Complete context and clarification to enable generation.";
  }, [
    contextText,
    planningStatus,
    requiresLocalUserHeader,
    workspaceState.canGenerate,
    workspaceState.clarification.readyForGeneration,
    workspaceState.documents.length,
  ]);

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Planning Workspace
        </h2>
        <p className="mt-2 text-sm text-slate-600">Loading workspace data...</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Planning Workspace
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Context + docs -&gt; clarify -&gt; generate -&gt; review -&gt; lock
            -&gt; assign
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase text-slate-700">
          {planningStatus}
        </span>
      </div>

      {loadError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      ) : null}

      {requiresLocalUserHeader ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {canGenerateMessage}
        </p>
      ) : null}

      <ContextEditor
        contexts={workspaceState.contexts}
        error={contextError}
        initialText={contextText}
        isSaving={isSavingContext}
        onSave={handleSaveContext}
      />

      <section className="space-y-3 rounded-lg border border-neutral-200 p-4">
        <h3 className="text-base font-semibold">2. Supporting Documents</h3>
        <label className="inline-flex cursor-pointer items-center rounded border border-black/20 px-3 py-2 text-sm">
          <input
            className="hidden"
            type="file"
            onChange={handleDocumentUpload}
            disabled={isUploadingDocument}
          />
          {isUploadingDocument ? "Uploading..." : "Upload document"}
        </label>

        {workspaceState.documents.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-600">
            No documents uploaded for planning yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {workspaceState.documents.map((document) => (
              <li
                key={document.id}
                className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-800"
              >
                <p className="font-medium">{document.fileName}</p>
                <p className="text-xs text-neutral-500">
                  Added {new Date(document.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}

        {documentsError ? (
          <p className="text-sm text-red-600">{documentsError}</p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-200 p-4">
        <h3 className="text-base font-semibold">3. Clarify Ambiguities</h3>
        <ClarificationPanel
          disabled={requiresLocalUserHeader}
          onStateChange={handleClarificationState}
          projectId={projectId}
          userIdHeaderValue={userIdHeaderValue}
        />
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-200 p-4">
        <h3 className="text-base font-semibold">4. Generate Draft Tasks</h3>
        <p className="text-sm text-neutral-600">{canGenerateMessage}</p>
        <button
          type="button"
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
          onClick={runGenerate}
          disabled={!workspaceState.canGenerate || isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate draft tasks"}
        </button>
      </section>

      <section className="space-y-3 rounded-lg border border-neutral-200 p-4">
        <h3 className="text-base font-semibold">5. Review, Lock, and Assign</h3>
        <p className="text-sm text-neutral-600">
          {taskCount > 0
            ? `${taskCount} tasks in the draft board.`
            : "No tasks generated yet."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/projects/${projectId}/board`}
            className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Review and edit tasks
          </Link>
          <button
            type="button"
            className="rounded border border-black px-3 py-2 text-sm disabled:opacity-50"
            onClick={runLock}
            disabled={!canLock || isLocking}
          >
            {isLocking ? "Locking..." : "Lock plan"}
          </button>
          <button
            type="button"
            className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
            onClick={runAssign}
            disabled={!canAssign || isAssigning}
          >
            {isAssigning ? "Assigning..." : "Run final assignment"}
          </button>
        </div>
        {assignedCount !== null ? (
          <p className="text-xs text-neutral-600">
            Assigned {assignedCount} tasks in the last run.
          </p>
        ) : null}
      </section>

      {actionStatus ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {actionStatus}
        </p>
      ) : null}

      {actionError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}
