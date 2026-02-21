"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { ClarificationPanel } from "@/components/projects/clarification-panel";
import { ContextEditor } from "@/components/projects/context-editor";
import {
  DependencyEdge,
  PlanningWorkspaceState,
  ProjectPlanningStatus,
  ProjectTask,
} from "@/types/dashboard";

type PlanningWorkspaceProps = {
  initialDependencyEdges: DependencyEdge[];
  initialProjectDescription: string;
  initialState: PlanningWorkspaceState;
  initialTasks: ProjectTask[];
  planningStatus: ProjectPlanningStatus;
  projectId: string;
  onPlanningStatusChange: (nextStatus: ProjectPlanningStatus) => void;
  onTasksChange: (
    nextTasks: ProjectTask[],
    nextDependencyEdges: DependencyEdge[],
  ) => void;
};

type GenerateTasksResponse = {
  tasks: Array<{
    id: string;
    projectId: string;
    assigneeUserId: string | null;
    title: string;
    description: string;
    difficultyPoints: 1 | 2 | 3 | 5 | 8;
    status: "todo" | "in_progress" | "blocked" | "done";
    dueAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  taskDependencies: Array<{
    id: string;
    taskId: string;
    dependsOnTaskId: string;
  }>;
};

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

const FALLBACK_STATUSES = new Set([404, 405, 501]);

const MOCK_GENERATED_TASKS: ProjectTask[] = [
  {
    id: "mock-task-1",
    title: "Draft requirement summary",
    status: "todo",
    assigneeUserId: null,
    difficultyPoints: 2,
  },
  {
    id: "mock-task-2",
    title: "Design data model alignment",
    status: "todo",
    assigneeUserId: null,
    difficultyPoints: 3,
  },
  {
    id: "mock-task-3",
    title: "Prepare review checklist",
    status: "todo",
    assigneeUserId: null,
    difficultyPoints: 1,
  },
];

const MOCK_DEPENDENCIES: DependencyEdge[] = [
  {
    taskId: "mock-task-2",
    dependsOnTaskId: "mock-task-1",
  },
  {
    taskId: "mock-task-3",
    dependsOnTaskId: "mock-task-2",
  },
];

export function PlanningWorkspace({
  initialDependencyEdges,
  initialProjectDescription,
  initialState,
  initialTasks,
  planningStatus,
  projectId,
  onPlanningStatusChange,
  onTasksChange,
}: PlanningWorkspaceProps) {
  const [workspaceState, setWorkspaceState] = useState(initialState);
  const [contextText, setContextText] = useState(initialProjectDescription);
  const [tasks, setTasks] = useState(initialTasks);
  const [dependencyEdges, setDependencyEdges] = useState(
    initialDependencyEdges,
  );
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const hasMinimumContext = useMemo(
    () =>
      contextText.trim().length > 0 ||
      workspaceState.documents.length > 0 ||
      workspaceState.contexts.length > 0,
    [
      contextText,
      workspaceState.documents.length,
      workspaceState.contexts.length,
    ],
  );

  useEffect(() => {
    setWorkspaceState((previous) => ({
      ...previous,
      canGenerate:
        hasMinimumContext && previous.clarification.readyForGeneration,
    }));
  }, [hasMinimumContext]);

  const syncTaskState = (
    nextTasks: ProjectTask[],
    nextDependencyEdges: DependencyEdge[],
  ) => {
    setTasks(nextTasks);
    setDependencyEdges(nextDependencyEdges);
    onTasksChange(nextTasks, nextDependencyEdges);
  };

  const handleContextSaved = (
    contextEntry: PlanningWorkspaceState["contexts"][number],
    nextText: string,
  ) => {
    setContextText(nextText);
    setWorkspaceState((previous) => {
      const withoutExistingInitial = previous.contexts.filter(
        (item) => item.contextType !== "initial",
      );

      return {
        ...previous,
        contexts: [contextEntry, ...withoutExistingInitial],
      };
    });
  };

  const uploadDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    setIsUploadingDocuments(true);
    setWorkspaceError(null);
    setWorkspaceMessage(null);

    const uploaded: PlanningWorkspaceState["documents"] = [];
    let usedLocalFallback = false;
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
          const message =
            payload?.error?.message ?? `Failed to upload ${file.name}.`;

          if (FALLBACK_STATUSES.has(response.status)) {
            uploaded.push({
              id: `local-doc-${Date.now()}-${file.name}`,
              fileName: file.name,
              createdAt: new Date().toISOString(),
            });
            usedLocalFallback = true;
            firstError ??= message;
          } else {
            firstError ??= message;
          }

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
        uploaded.push({
          id: `local-doc-${Date.now()}-${file.name}`,
          fileName: file.name,
          createdAt: new Date().toISOString(),
        });
        usedLocalFallback = true;
        firstError ??=
          error instanceof Error
            ? error.message
            : `Unable to upload ${file.name}.`;
      }
    }

    setWorkspaceState((previous) => ({
      ...previous,
      documents: [...uploaded, ...previous.documents],
    }));

    if (usedLocalFallback) {
      setWorkspaceMessage(
        "Some files were saved in local scaffold mode because document upload APIs are unavailable.",
      );
    } else if (uploaded.length > 0) {
      setWorkspaceMessage("Documents uploaded.");
    }

    setWorkspaceError(firstError);
    setIsUploadingDocuments(false);

    event.target.value = "";
  };

  const handleClarificationUpdate = (
    nextClarification: PlanningWorkspaceState["clarification"],
  ) => {
    setWorkspaceState((previous) => ({
      ...previous,
      clarification: nextClarification,
      canGenerate: hasMinimumContext && nextClarification.readyForGeneration,
    }));
  };

  const generateDraftTasks = async () => {
    setIsGenerating(true);
    setWorkspaceError(null);
    setWorkspaceMessage(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/ai/generate-tasks`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        const message =
          payload?.error?.message ?? "Unable to generate draft tasks.";

        if (FALLBACK_STATUSES.has(response.status)) {
          syncTaskState(MOCK_GENERATED_TASKS, MOCK_DEPENDENCIES);
          setWorkspaceError(message);
          setWorkspaceMessage(
            "Loaded scaffolded mock draft because generation API is unavailable.",
          );
          return;
        }

        setWorkspaceError(message);
        return;
      }

      const payload = (await response.json()) as GenerateTasksResponse;

      const nextTasks: ProjectTask[] = payload.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        assigneeUserId: task.assigneeUserId,
        difficultyPoints: task.difficultyPoints,
      }));

      const nextDependencyEdges: DependencyEdge[] =
        payload.taskDependencies.map((dependency) => ({
          taskId: dependency.taskId,
          dependsOnTaskId: dependency.dependsOnTaskId,
        }));

      syncTaskState(nextTasks, nextDependencyEdges);
      setWorkspaceMessage("Draft tasks generated.");
    } catch (error) {
      syncTaskState(MOCK_GENERATED_TASKS, MOCK_DEPENDENCIES);
      setWorkspaceError(
        error instanceof Error ? error.message : "Generation failed.",
      );
      setWorkspaceMessage(
        "Loaded scaffolded mock draft because generation API is unavailable.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const updateTask = (taskId: string, changes: Partial<ProjectTask>) => {
    const nextTasks = tasks.map((task) =>
      task.id === taskId ? { ...task, ...changes } : task,
    );
    syncTaskState(nextTasks, dependencyEdges);
  };

  const lockPlan = async () => {
    setIsLocking(true);
    setWorkspaceError(null);
    setWorkspaceMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/planning/lock`, {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiErrorPayload | null;
        const message =
          payload?.error?.message ?? "Unable to lock planning state.";

        if (FALLBACK_STATUSES.has(response.status)) {
          onPlanningStatusChange("locked");
          setWorkspaceError(message);
          setWorkspaceMessage(
            "Locked locally while planning lock API is unavailable.",
          );
          return;
        }

        setWorkspaceError(message);
        return;
      }

      onPlanningStatusChange("locked");
      setWorkspaceMessage("Plan locked.");
    } catch (error) {
      onPlanningStatusChange("locked");
      setWorkspaceError(
        error instanceof Error ? error.message : "Lock action failed.",
      );
      setWorkspaceMessage(
        "Locked locally while planning lock API is unavailable.",
      );
    } finally {
      setIsLocking(false);
    }
  };

  const runAssignment = async () => {
    setIsAssigning(true);
    setWorkspaceError(null);
    setWorkspaceMessage(null);

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
        const message = payload?.error?.message ?? "Unable to run assignment.";

        if (FALLBACK_STATUSES.has(response.status)) {
          onPlanningStatusChange("assigned");
          setWorkspaceError(message);
          setWorkspaceMessage(
            "Assignment status advanced locally while assignment API is unavailable.",
          );
          return;
        }

        setWorkspaceError(message);
        return;
      }

      onPlanningStatusChange("assigned");
      setWorkspaceMessage("Final assignment run completed.");
    } catch (error) {
      onPlanningStatusChange("assigned");
      setWorkspaceError(
        error instanceof Error ? error.message : "Assignment run failed.",
      );
      setWorkspaceMessage(
        "Assignment status advanced locally while assignment API is unavailable.",
      );
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Workspace Flow
        </p>
        <h2 className="text-xl font-semibold text-slate-900">
          Context -&gt; Clarify -&gt; Generate -&gt; Review -&gt; Lock -&gt;
          Assign
        </h2>
        <p className="text-sm text-slate-600">
          Planning status: {planningStatus}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ContextEditor
          disabled={planningStatus !== "draft"}
          initialText={contextText}
          projectId={projectId}
          onContextSaved={handleContextSaved}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              2. Documents
            </h3>
            <span className="text-xs text-slate-500">Optional uploads</span>
          </div>

          <label className="mb-3 block rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            <input
              className="hidden"
              disabled={planningStatus !== "draft" || isUploadingDocuments}
              multiple
              onChange={uploadDocuments}
              type="file"
            />
            {isUploadingDocuments
              ? "Uploading..."
              : "Select files (PDF, DOCX, TXT)"}
          </label>

          {workspaceState.documents.length === 0 ? (
            <p className="text-sm text-slate-500">No documents uploaded yet.</p>
          ) : (
            <ul className="space-y-2">
              {workspaceState.documents.map((document) => (
                <li
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  key={document.id}
                >
                  <p className="font-medium">{document.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(document.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ClarificationPanel
        hasMinimumContext={hasMinimumContext}
        initialClarification={workspaceState.clarification}
        projectId={projectId}
        onClarificationUpdate={handleClarificationUpdate}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">
            4. Draft Generation and Review
          </h3>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={
              !workspaceState.canGenerate ||
              planningStatus !== "draft" ||
              isGenerating
            }
            onClick={generateDraftTasks}
            type="button"
          >
            {isGenerating ? "Generating..." : "Generate Draft"}
          </button>
        </div>

        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            No draft tasks yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {tasks.map((task) => (
              <li
                className="rounded-xl border border-slate-200 p-3"
                key={task.id}
              >
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr,140px,120px]">
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400"
                    onChange={(event) =>
                      updateTask(task.id, { title: event.target.value })
                    }
                    value={task.title}
                  />
                  <select
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400"
                    onChange={(event) =>
                      updateTask(task.id, {
                        status: event.target.value as ProjectTask["status"],
                      })
                    }
                    value={task.status}
                  >
                    <option value="todo">todo</option>
                    <option value="in_progress">in_progress</option>
                    <option value="blocked">blocked</option>
                    <option value="done">done</option>
                  </select>
                  <select
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-400"
                    onChange={(event) =>
                      updateTask(task.id, {
                        difficultyPoints: Number(
                          event.target.value,
                        ) as ProjectTask["difficultyPoints"],
                      })
                    }
                    value={task.difficultyPoints}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
            disabled={
              planningStatus !== "draft" || tasks.length === 0 || isLocking
            }
            onClick={lockPlan}
            type="button"
          >
            {isLocking ? "Locking..." : "5. Lock Plan"}
          </button>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={
              planningStatus !== "locked" || tasks.length === 0 || isAssigning
            }
            onClick={runAssignment}
            type="button"
          >
            {isAssigning ? "Assigning..." : "6. Run Final Assignment"}
          </button>
        </div>
      </section>

      {workspaceMessage ? (
        <p className="text-sm text-emerald-700">{workspaceMessage}</p>
      ) : null}
      {workspaceError ? (
        <p className="text-sm text-amber-700">{workspaceError}</p>
      ) : null}
    </section>
  );
}
