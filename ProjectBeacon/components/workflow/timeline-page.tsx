"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

type TimelineVisualState =
  | "completed"
  | "support_needed"
  | "predicted"
  | "upcoming";

type RailMarker = {
  taskId: string;
  label: string;
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
    totalTasks: 4,
    phase: "beginning",
    dueDatePlacement: "early",
  },
  {
    id: "t_timeline_2",
    title: "Generate workflow board",
    status: "blocked",
    softDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    difficultyPoints: 3,
    assigneeUserId: "user_002",
    sequenceIndex: 1,
    totalTasks: 4,
    phase: "middle",
    dueDatePlacement: "mid",
  },
  {
    id: "t_timeline_3",
    title: "Synthesize component library",
    status: "in_progress",
    softDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    difficultyPoints: 5,
    assigneeUserId: "user_003",
    sequenceIndex: 2,
    totalTasks: 4,
    phase: "middle",
    dueDatePlacement: "late",
  },
  {
    id: "t_timeline_4",
    title: "Run final delivery review",
    status: "todo",
    softDeadline: null,
    difficultyPoints: 2,
    assigneeUserId: null,
    sequenceIndex: 3,
    totalTasks: 4,
    phase: "end",
    dueDatePlacement: "unscheduled",
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
  {
    taskId: "t_timeline_4",
    dependsOnTaskId: "t_timeline_3",
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

function formatDateLabel(value: string | null): string {
  if (!value) {
    return "No due date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCountdown(value: string | null): string {
  if (!value) {
    return "No deadline";
  }

  const target = new Date(value).getTime();
  if (Number.isNaN(target)) {
    return "Invalid deadline";
  }

  const diff = target - Date.now();
  if (diff <= 0) {
    return "Deadline passed";
  }

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return `${days}d : ${hours}h : ${minutes}m`;
}

function toVisualState(
  task: WorkflowTimelineTaskDTO,
  blockedIds: Set<string>,
  dependenciesByTask: Map<string, string[]>,
): TimelineVisualState {
  if (task.status === "done") {
    return "completed";
  }

  if (task.status === "blocked") {
    return "support_needed";
  }

  const dependencies = dependenciesByTask.get(task.id) ?? [];
  const blockedDependency = dependencies.some((id) => blockedIds.has(id));

  if (
    blockedDependency ||
    task.dueDatePlacement === "late" ||
    task.dueDatePlacement === "unscheduled"
  ) {
    return "predicted";
  }

  return "upcoming";
}

function buildRailMarkers(tasks: WorkflowTimelineTaskDTO[]): RailMarker[] {
  if (tasks.length === 0) {
    return [];
  }

  const count = Math.min(4, tasks.length);
  const seen = new Set<number>();
  const markers: RailMarker[] = [];

  for (let index = 0; index < count; index += 1) {
    const ratio = count === 1 ? 0 : index / (count - 1);
    const sourceIndex = Math.round(ratio * (tasks.length - 1));

    if (seen.has(sourceIndex)) {
      continue;
    }

    seen.add(sourceIndex);

    markers.push({
      taskId: tasks[sourceIndex].id,
      label: `DAY ${String(sourceIndex * 2 + 1).padStart(2, "0")}`,
    });
  }

  return markers;
}

function stateBadgeClass(state: TimelineVisualState): string {
  if (state === "completed") {
    return "bg-emerald-500/15 text-emerald-300";
  }

  if (state === "support_needed") {
    return "bg-amber-500/15 text-amber-300";
  }

  if (state === "predicted") {
    return "bg-violet-500/15 text-violet-300";
  }

  return "bg-slate-100/10 text-slate-300";
}

function stateLabel(state: TimelineVisualState): string {
  if (state === "completed") {
    return "Completed";
  }

  if (state === "support_needed") {
    return "Support Signal";
  }

  if (state === "predicted") {
    return "Predicted Shift";
  }

  return "Upcoming";
}

function stateCardClass(state: TimelineVisualState): string {
  if (state === "completed") {
    return "border-emerald-400/40 bg-slate-900/95";
  }

  if (state === "support_needed") {
    return "border-amber-400 bg-slate-900 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]";
  }

  if (state === "predicted") {
    return "border-violet-500/30 bg-slate-900/50 opacity-65";
  }

  return "border-slate-700 bg-slate-900/90";
}

export function TimelinePage({
  projectId,
  role,
  selectedTaskId,
}: TimelinePageProps) {
  const router = useRouter();

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

  const dependentsByTask = useMemo(() => {
    const map = new Map<string, string[]>();

    for (const edge of edges) {
      const dependents = map.get(edge.dependsOnTaskId) ?? [];
      dependents.push(edge.taskId);
      map.set(edge.dependsOnTaskId, dependents);
    }

    for (const [taskId, dependentIds] of map.entries()) {
      map.set(
        taskId,
        [...new Set(dependentIds)].sort((a, b) => a.localeCompare(b)),
      );
    }

    return map;
  }, [edges]);

  const blockedIds = useMemo(
    () =>
      new Set(
        orderedTasks
          .filter((task) => task.status === "blocked")
          .map((task) => task.id),
      ),
    [orderedTasks],
  );

  const visualStateByTask = useMemo(() => {
    const map = new Map<string, TimelineVisualState>();

    for (const task of orderedTasks) {
      map.set(task.id, toVisualState(task, blockedIds, dependenciesByTask));
    }

    return map;
  }, [blockedIds, dependenciesByTask, orderedTasks]);

  const railMarkers = useMemo(
    () => buildRailMarkers(orderedTasks),
    [orderedTasks],
  );

  const lastDeadline = useMemo(() => {
    const withDeadlines = orderedTasks
      .map((task) => task.softDeadline)
      .filter((value): value is string => Boolean(value));

    if (withDeadlines.length === 0) {
      return null;
    }

    return (
      withDeadlines
        .map((value) => ({ value, time: new Date(value).getTime() }))
        .filter((item) => !Number.isNaN(item.time))
        .sort((a, b) => b.time - a.time)[0]?.value ?? null
    );
  }, [orderedTasks]);

  return (
    <section className="rounded-3xl border border-violet-950/60 bg-gradient-to-b from-[#120d23] via-[#0e1124] to-[#120d23] p-5 text-slate-100 shadow-[0_20px_60px_rgba(5,8,20,0.55)] sm:p-7">
      <header className="rounded-2xl border border-violet-900/60 bg-[#141129]/90 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">
              Project Timeline
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Micro-Goal Dependency View
            </h1>
            <p className="text-sm text-slate-300">
              Sequence tasks by dependency and monitor impact across milestones.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="rounded-lg border border-violet-900/70 bg-violet-500/15 px-3 py-1.5 text-sm font-semibold text-violet-100"
              href={`/projects/${projectId}/timeline`}
            >
              Timeline
            </Link>
            <Link
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:border-violet-500/60"
              href={`/projects/${projectId}/board`}
            >
              Board
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(200px,1fr)_auto_auto] md:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/70">
              Countdown To Final Milestone
            </p>
            <p className="mt-1 text-xl font-semibold text-white">
              {formatCountdown(lastDeadline)}
            </p>
            <p className="text-xs text-slate-400">
              Final due: {formatDateLabel(lastDeadline)}
            </p>
          </div>

          <label className="block text-xs text-slate-300">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Select Task
            </span>
            <select
              className="w-full min-w-48 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-violet-400 transition focus:ring-2"
              onChange={(event) => {
                const nextTaskId = event.target.value;
                const nextUrl =
                  nextTaskId.length > 0
                    ? `/projects/${projectId}/timeline?taskId=${encodeURIComponent(nextTaskId)}`
                    : `/projects/${projectId}/timeline`;

                router.push(nextUrl);
              }}
              value={selectedTaskId ?? ""}
            >
              <option value="">All tasks</option>
              {orderedTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.sequenceIndex + 1}. {task.title}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-100">
            Role `{capability.role}` · edit workflow:{" "}
            {capability.canEditWorkflow ? "yes" : "no"}
          </div>
        </div>
      </header>

      {error ? (
        <p className="mt-4 rounded-xl border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Loading timeline...
        </p>
      ) : orderedTasks.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
          No tasks available for timeline ordering.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[92px_minmax(0,1fr)]">
          <aside className="relative hidden lg:block">
            <div className="absolute left-1/2 top-1 bottom-1 w-[2px] -translate-x-1/2 bg-gradient-to-b from-violet-400 via-violet-500/20 to-transparent" />
            <ol className="flex h-full flex-col justify-between">
              {railMarkers.map((marker, markerIndex) => {
                const active =
                  marker.taskId === selectedTaskId ||
                  (selectedTaskId === null && markerIndex === 0);

                return (
                  <li
                    key={marker.taskId}
                    className="relative flex flex-col items-center"
                  >
                    <span
                      className={`h-3.5 w-3.5 rounded-full ring-4 ring-[#120d23] ${
                        active ? "bg-violet-400" : "bg-slate-500"
                      }`}
                    />
                    <span className="mt-1 text-[10px] font-bold tracking-[0.12em] text-slate-400">
                      {marker.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </aside>

          <ol className="space-y-4">
            {orderedTasks.map((task) => {
              const dependencies = dependenciesByTask.get(task.id) ?? [];
              const dependents = dependentsByTask.get(task.id) ?? [];
              const visualState = visualStateByTask.get(task.id) ?? "upcoming";
              const isSelected = selectedTaskId === task.id;
              const predictedHours =
                dependents.length > 0 ? dependents.length * 12 : 0;

              return (
                <li
                  key={task.id}
                  className="relative grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px]"
                  id={`task-${task.id}`}
                >
                  <article
                    className={`rounded-2xl border p-4 transition ${stateCardClass(visualState)} ${
                      isSelected ? "ring-2 ring-violet-400/70" : ""
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${stateBadgeClass(visualState)}`}
                        >
                          {stateLabel(visualState)}
                        </span>
                        <h2 className="mt-2 text-lg font-semibold text-white">
                          {task.title}
                        </h2>
                      </div>

                      {isSelected ? (
                        <span className="rounded-full bg-violet-500/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-100">
                          Focused
                        </span>
                      ) : null}
                    </div>

                    <p className="text-sm text-slate-300">
                      Status:{" "}
                      <span className="font-medium text-slate-100">
                        {task.status}
                      </span>{" "}
                      · Phase{" "}
                      <span className="font-medium text-slate-100">
                        {task.phase}
                      </span>{" "}
                      · {task.difficultyPoints} pts
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      Due {formatDateLabel(task.softDeadline)} · Placement{" "}
                      {task.dueDatePlacement} · Assignee{" "}
                      {task.assigneeUserId ?? "unassigned"}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      Dependencies:{" "}
                      {dependencies.length > 0
                        ? dependencies.join(", ")
                        : "none"}
                    </p>
                  </article>

                  <aside className="space-y-2">
                    {visualState === "support_needed" &&
                    dependents.length > 0 ? (
                      <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                          Impact Prediction
                        </p>
                        <p className="mt-1 text-sm font-medium text-amber-100">
                          +{predictedHours}h downstream delay
                        </p>
                        <p className="mt-1 text-xs text-amber-200/80">
                          Affecting {dependents.length} dependent task
                          {dependents.length === 1 ? "" : "s"}.
                        </p>
                      </div>
                    ) : null}

                    {visualState === "predicted" ? (
                      <div className="rounded-xl border border-violet-400/35 bg-violet-500/10 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">
                          Predicted Shift
                        </p>
                        <p className="mt-1 text-xs text-violet-100/80">
                          This goal may move due to blocked dependencies or late
                          placement.
                        </p>
                      </div>
                    ) : null}
                  </aside>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
