"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DependencyEdge,
  PlanningWorkspaceState,
  ProjectPlanningStatus,
  ProjectTask,
} from "@/types/dashboard";

export const FALLBACK_STATUSES = new Set([404, 405, 501]);
export const CLARIFICATION_TARGET = 85;
const STORAGE_VERSION = 1;

type WorkspaceDraft = {
  contextText: string;
  contexts: PlanningWorkspaceState["contexts"];
  documents: PlanningWorkspaceState["documents"];
  clarification: PlanningWorkspaceState["clarification"];
  canGenerate: boolean;
  tasks: ProjectTask[];
  dependencyEdges: DependencyEdge[];
  planningStatus: ProjectPlanningStatus;
};

type StoredWorkspaceDraft = {
  version: number;
  payload: WorkspaceDraft;
};

type WorkspaceDraftOptions = {
  initialDescription: string;
  initialPlanningStatus: ProjectPlanningStatus;
  initialClarification: PlanningWorkspaceState["clarification"];
  projectId: string;
};

export type GenerateTasksResponse = {
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

export const MOCK_QUESTIONS = [
  "What are the required final deliverables?",
  "Which technologies are mandatory versus optional?",
  "Are there any hard checkpoints before the final deadline?",
];

export const MOCK_GENERATED_TASKS: ProjectTask[] = [
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

export const MOCK_DEPENDENCIES: DependencyEdge[] = [
  {
    taskId: "mock-task-2",
    dependsOnTaskId: "mock-task-1",
  },
  {
    taskId: "mock-task-3",
    dependsOnTaskId: "mock-task-2",
  },
];

export type WorkspaceDraftState = ReturnType<typeof useWorkspaceDraft>;
export type { WorkspaceDraft };

export function toProjectTasks(payload: GenerateTasksResponse): ProjectTask[] {
  return payload.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    assigneeUserId: task.assigneeUserId,
    difficultyPoints: task.difficultyPoints,
  }));
}

export function toDependencyEdges(
  payload: GenerateTasksResponse,
): DependencyEdge[] {
  return payload.taskDependencies.map((dependency) => ({
    taskId: dependency.taskId,
    dependsOnTaskId: dependency.dependsOnTaskId,
  }));
}

export function createContextEntry(
  title: string,
  contextType: string,
): PlanningWorkspaceState["contexts"][number] {
  const now = new Date().toISOString();

  return {
    id: `ctx-${now}`,
    title,
    contextType,
    createdAt: now,
  };
}

export function createLocalDocument(fileName: string) {
  return {
    id: `local-doc-${Date.now()}-${fileName}`,
    fileName,
    createdAt: new Date().toISOString(),
  };
}

function getStorageKey(projectId: string): string {
  return `project-beacon:workspace:${projectId}`;
}

function hasMinimumContext(draft: WorkspaceDraft): boolean {
  return (
    draft.contextText.trim().length > 0 ||
    draft.contexts.length > 0 ||
    draft.documents.length > 0
  );
}

function normalizeDraft(draft: WorkspaceDraft): WorkspaceDraft {
  return {
    ...draft,
    canGenerate:
      hasMinimumContext(draft) && draft.clarification.readyForGeneration,
  };
}

function buildInitialDraft(options: WorkspaceDraftOptions): WorkspaceDraft {
  const baseContexts =
    options.initialDescription.trim().length > 0
      ? [
          {
            id: `ctx-initial-${options.projectId}`,
            title: "Project requirements",
            contextType: "initial",
            createdAt: new Date().toISOString(),
          },
        ]
      : [];

  return normalizeDraft({
    contextText: options.initialDescription,
    contexts: baseContexts,
    documents: [],
    clarification: options.initialClarification,
    canGenerate: false,
    tasks: [],
    dependencyEdges: [],
    planningStatus: options.initialPlanningStatus,
  });
}

function readStoredDraft(projectId: string): WorkspaceDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(projectId));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredWorkspaceDraft;

    if (!parsed || parsed.version !== STORAGE_VERSION) {
      return null;
    }

    return normalizeDraft(parsed.payload);
  } catch {
    return null;
  }
}

function writeStoredDraft(projectId: string, draft: WorkspaceDraft): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload: StoredWorkspaceDraft = {
    version: STORAGE_VERSION,
    payload: normalizeDraft(draft),
  };

  window.localStorage.setItem(
    getStorageKey(projectId),
    JSON.stringify(payload),
  );
}

export function useWorkspaceDraft(options: WorkspaceDraftOptions) {
  const {
    initialClarification,
    initialDescription,
    initialPlanningStatus,
    projectId,
  } = options;
  const initialDraft = useMemo(
    () =>
      buildInitialDraft({
        initialClarification,
        initialDescription,
        initialPlanningStatus,
        projectId,
      }),
    [
      initialClarification.askedCount,
      initialClarification.confidence,
      initialClarification.maxQuestions,
      initialClarification.readyForGeneration,
      initialDescription,
      initialPlanningStatus,
      projectId,
    ],
  );
  const [draft, setDraft] = useState<WorkspaceDraft>(initialDraft);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredDraft(projectId);

    if (stored) {
      setDraft(stored);
    } else {
      writeStoredDraft(projectId, initialDraft);
      setDraft(initialDraft);
    }

    setIsHydrated(true);
  }, [initialDraft, projectId]);

  const replaceDraft = useCallback(
    (nextDraft: WorkspaceDraft) => {
      const normalized = normalizeDraft(nextDraft);
      setDraft(normalized);
      writeStoredDraft(projectId, normalized);
    },
    [projectId],
  );

  const updateDraft = useCallback(
    (updater: (previous: WorkspaceDraft) => WorkspaceDraft) => {
      setDraft((previous) => {
        const normalized = normalizeDraft(updater(previous));
        writeStoredDraft(projectId, normalized);
        return normalized;
      });
    },
    [projectId],
  );

  return {
    draft,
    isHydrated,
    replaceDraft,
    updateDraft,
  };
}
