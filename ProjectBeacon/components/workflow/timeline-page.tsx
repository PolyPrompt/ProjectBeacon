"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";

import type {
  WorkflowTimelineDTO,
  WorkflowTimelineEdgeDTO,
  WorkflowTimelineTaskDTO,
} from "@/types/workflow";

type TimelinePageProps = {
  projectId: string;
  role: "admin" | "user";
  selectedTaskId: string | null;
};

const FALLBACK_TASKS: WorkflowTimelineTaskDTO[] = [
  {
    id: "t_timeline_1",
    title: "Collect project requirements",
    status: "done",
    softDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    difficultyPoints: 2,
    assigneeUserId: "user_001",
    sequenceIndex: 0,
    totalTasks: 3,
    phase: "beginning",
    dueDatePlacement: "early",
  },
  {
    id: "t_timeline_2",
    title: "Generate workflow board",
    status: "in_progress",
    softDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    difficultyPoints: 3,
    assigneeUserId: "user_002",
    sequenceIndex: 1,
    totalTasks: 3,
    phase: "middle",
    dueDatePlacement: "mid",
  },
  {
    id: "t_timeline_3",
    title: "Final review and submission",
    status: "todo",
    softDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    difficultyPoints: 5,
    assigneeUserId: null,
    sequenceIndex: 2,
    totalTasks: 3,
    phase: "end",
    dueDatePlacement: "late",
  },
];

const FALLBACK_EDGES: WorkflowTimelineEdgeDTO[] = [
  {
    taskId: "t_timeline_2",
    dependsOnTaskId: "t_timeline_1",
  },
  {
    taskId: "t_timeline_3",
    dependsOnTaskId: "t_timeline_2",
  },
];

function parseTimelinePayload(value: unknown): WorkflowTimelineDTO | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<WorkflowTimelineDTO>;

  if (!payload.capability || typeof payload.capability !== "object") {
    return null;
  }

  if (!Array.isArray(payload.tasks) || !Array.isArray(payload.edges)) {
    return null;
  }

  return {
    capability: {
      role: payload.capability.role === "admin" ? "admin" : "user",
      canManageProject: Boolean(payload.capability.canManageProject),
      canEditWorkflow: Boolean(payload.capability.canEditWorkflow),
    },
    tasks: payload.tasks,
    edges: payload.edges,
  };
}

function dueDateLabel(value: string | null): string {
  if (!value) {
    return "No due date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString();
}

export function TimelinePage({
  projectId,
  role,
  selectedTaskId,
}: TimelinePageProps) {
  const [tasks, setTasks] = useState<WorkflowTimelineTaskDTO[]>([]);
  const [edges, setEdges] = useState<WorkflowTimelineEdgeDTO[]>([]);
  const [capability, setCapability] = useState({
    role,
    canManageProject: role === "admin",
    canEditWorkflow: role === "admin",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadTimeline() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/projects/${projectId}/workflow/timeline`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Timeline endpoint returned ${response.status}`);
        }

        const payload = parseTimelinePayload(
          (await response.json()) as unknown,
        );
        if (!payload) {
          throw new Error("Timeline payload missing required fields.");
        }

        if (!cancelled) {
          setTasks(payload.tasks);
          setEdges(payload.edges);
          setCapability(payload.capability);
        }
      } catch (timelineError) {
        if (!cancelled) {
          setTasks(FALLBACK_TASKS);
          setEdges(FALLBACK_EDGES);
          setCapability({
            role,
            canManageProject: role === "admin",
            canEditWorkflow: role === "admin",
          });
          setError(
            timelineError instanceof Error
              ? `${timelineError.message}. Showing scaffold timeline.`
              : "Failed to load timeline. Showing scaffold timeline.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTimeline();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, role]);

  const orderedTasks = useMemo(
    () =>
      [...tasks].sort(
        (left, right) => left.sequenceIndex - right.sequenceIndex,
      ),
    [tasks],
  );

  const dependenciesByTask = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const edge of edges) {
      const dependencies = map.get(edge.taskId) ?? [];
      dependencies.push(edge.dependsOnTaskId);
      map.set(edge.taskId, dependencies);
    }

    for (const [taskId, dependencyIds] of map.entries()) {
      map.set(
        taskId,
        [...new Set(dependencyIds)].sort((a, b) => a.localeCompare(b)),
      );
    }

    return map;
  }, [edges]);

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Workflow Timeline
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Ordered execution view with phase positions and dependency links.
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-300 p-1">
            <Link
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              href={`/projects/${projectId}/board`}
            >
              Board
            </Link>
            <Link
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white"
              href={`/projects/${projectId}/timeline`}
            >
              Timeline
            </Link>
          </div>
        </div>
        <p className="mt-3 text-xs font-medium text-slate-500">
          Capability: role `{capability.role}` · manage project:{" "}
          {capability.canManageProject ? "yes" : "no"} · edit workflow:{" "}
          {capability.canEditWorkflow ? "yes" : "no"}
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Loading timeline...
        </p>
      ) : orderedTasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
          No tasks available for timeline ordering.
        </p>
      ) : (
        <ol className="space-y-3">
          {orderedTasks.map((task) => {
            const isSelected = task.id === selectedTaskId;
            const dependencyTaskIds = dependenciesByTask.get(task.id) ?? [];

            return (
              <li
                key={task.id}
                className={`rounded-2xl border bg-white p-4 shadow-sm ${
                  isSelected
                    ? "border-sky-400 ring-2 ring-sky-200"
                    : "border-slate-200"
                }`}
                id={`task-${task.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {task.sequenceIndex + 1}. {task.title}
                  </p>
                  {isSelected ? (
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">
                      Opened from dashboard deep-link
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {task.status} · phase {task.phase} · {task.difficultyPoints}{" "}
                  pts · due {dueDateLabel(task.softDeadline)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Assignee: {task.assigneeUserId ?? "unassigned"} · due
                  placement: {task.dueDatePlacement}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Dependencies:{" "}
                  {dependencyTaskIds.length > 0
                    ? dependencyTaskIds.join(", ")
                    : "none"}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
