"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { ProjectRole } from "@/types/roles";
import type {
  WorkflowBoardColumnDTO,
  WorkflowBoardDTO,
  WorkflowBoardMode,
  WorkflowBoardTaskDTO,
  WorkflowStatusBucket,
} from "@/types/workflow";

type BoardPageProps = {
  projectId: string;
  role: ProjectRole;
  viewerUserId: string;
};

type ProjectSummary = {
  deadline: string;
  id: string;
  name: string;
  planningStatus: "draft" | "locked" | "assigned";
};

type BoardTaskView = WorkflowBoardTaskDTO & {
  assigneeName: string;
  assigneeRole: ProjectRole | "unassigned";
  assigneeUserId: string | null;
};

type BoardLane = {
  id: string;
  title: string;
  taskCount: number;
  tasks: BoardTaskView[];
  tone: "viewer" | "unassigned" | "neutral";
};

type BoardAssigneeSummary = {
  id: string;
  label: string;
  taskCount: number;
  inProgressCount: number;
  blockedCount: number;
  contextLine: string;
  tone: BoardLane["tone"];
};

const MODE_OPTIONS: Array<{ id: WorkflowBoardMode; label: string }> = [
  { id: "member_lane", label: "Member Lanes" },
  { id: "categorized", label: "Categorized" },
  { id: "finalized", label: "Finalized" },
];

const STATUS_SECTIONS: Array<{
  bucket: WorkflowStatusBucket;
  heading: string;
}> = [
  { bucket: "in_progress", heading: "In Progress" },
  { bucket: "not_started", heading: "Not Started" },
  { bucket: "blocked", heading: "Blocked" },
  { bucket: "complete", heading: "Complete" },
];

const FALLBACK_PROJECT: ProjectSummary = {
  deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
  id: "fallback",
  name: "Project Alpha",
  planningStatus: "draft",
};

const FALLBACK_COLUMNS: WorkflowBoardColumnDTO[] = [
  {
    userId: "user_001",
    name: "Alex",
    email: "alex@example.edu",
    role: "admin",
    tasks: [
      {
        id: "t_board_1",
        title: "Refactor Legacy Auth",
        status: "todo",
        softDeadline: new Date(
          Date.now() + 4 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        difficultyPoints: 5,
        phase: "beginning",
      },
      {
        id: "t_board_2",
        title: "Scale Inference Engine",
        status: "in_progress",
        softDeadline: new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        difficultyPoints: 8,
        phase: "middle",
      },
    ],
  },
  {
    userId: "user_002",
    name: "Jordan",
    email: "jordan@example.edu",
    role: "user",
    tasks: [
      {
        id: "t_board_3",
        title: "Dataset Cleaning Pipeline",
        status: "blocked",
        softDeadline: new Date(
          Date.now() + 4 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        difficultyPoints: 3,
        phase: "end",
      },
    ],
  },
];

const FALLBACK_UNASSIGNED: WorkflowBoardTaskDTO[] = [
  {
    id: "t_board_4",
    title: "Unit Test Coverage",
    status: "todo",
    softDeadline: null,
    difficultyPoints: 2,
    phase: "middle",
  },
];

function parseBoardPayload(value: unknown): WorkflowBoardDTO | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<WorkflowBoardDTO>;

  if (!payload.capability || typeof payload.capability !== "object") {
    return null;
  }

  if (!Array.isArray(payload.columns) || !Array.isArray(payload.unassigned)) {
    return null;
  }

  return {
    capability: {
      role: payload.capability.role === "admin" ? "admin" : "user",
      canManageProject: Boolean(payload.capability.canManageProject),
      canEditWorkflow: Boolean(payload.capability.canEditWorkflow),
    },
    columns: payload.columns,
    unassigned: payload.unassigned,
  };
}

function parseProjectPayload(value: unknown): ProjectSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Partial<ProjectSummary>;
  if (
    typeof payload.id !== "string" ||
    typeof payload.name !== "string" ||
    typeof payload.deadline !== "string"
  ) {
    return null;
  }

  if (
    payload.planningStatus !== "draft" &&
    payload.planningStatus !== "locked" &&
    payload.planningStatus !== "assigned"
  ) {
    return null;
  }

  return {
    id: payload.id,
    name: payload.name,
    deadline: payload.deadline,
    planningStatus: payload.planningStatus,
  };
}

function toStatusBucket(
  status: WorkflowBoardTaskDTO["status"],
): WorkflowStatusBucket {
  if (status === "done") {
    return "complete";
  }
  if (status === "in_progress") {
    return "in_progress";
  }
  if (status === "blocked") {
    return "blocked";
  }

  return "not_started";
}

function statusLabel(status: WorkflowBoardTaskDTO["status"]): string {
  if (status === "todo") {
    return "Not Started";
  }
  if (status === "in_progress") {
    return "In Progress";
  }
  if (status === "blocked") {
    return "Needs Support";
  }

  return "Complete";
}

function statusChipClass(status: WorkflowBoardTaskDTO["status"]): string {
  if (status === "done") {
    return "bg-emerald-500/15 text-emerald-200 border border-emerald-400/40";
  }
  if (status === "in_progress") {
    return "bg-violet-500/15 text-violet-200 border border-violet-400/40";
  }
  if (status === "blocked") {
    return "bg-rose-500/15 text-rose-200 border border-rose-400/40";
  }

  return "bg-slate-500/15 text-slate-200 border border-slate-400/40";
}

function priorityTone(task: WorkflowBoardTaskDTO): {
  accentDot: string;
  borderTone: string;
} {
  if (task.difficultyPoints >= 5) {
    return {
      accentDot: "bg-violet-400",
      borderTone: "border-violet-500/30",
    };
  }

  if (task.difficultyPoints >= 3) {
    return {
      accentDot: "bg-amber-400",
      borderTone: "border-amber-500/30",
    };
  }

  return {
    accentDot: "bg-emerald-400",
    borderTone: "border-emerald-500/30",
  };
}

function dueLabel(value: string | null): string {
  if (!value) {
    return "Suggested deadline: TBD";
  }

  const due = new Date(value).getTime();
  if (Number.isNaN(due)) {
    return "Suggested deadline: invalid date";
  }

  const diffHours = Math.ceil((due - Date.now()) / (1000 * 60 * 60));
  if (diffHours <= 0) {
    return "Suggested deadline: today";
  }

  const diffDays = Math.ceil(diffHours / 24);
  return `Suggested deadline: ${diffDays}d`;
}

function deadlineCountdown(deadlineIso: string): string {
  const target = new Date(deadlineIso).getTime();
  if (Number.isNaN(target)) {
    return "Unknown";
  }

  const totalMinutes = Math.max(
    0,
    Math.floor((target - Date.now()) / (1000 * 60)),
  );
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return `${String(days).padStart(2, "0")}d : ${String(hours).padStart(2, "0")}h : ${String(minutes).padStart(2, "0")}m`;
}

function flattenBoard(
  columns: WorkflowBoardColumnDTO[],
  unassigned: WorkflowBoardTaskDTO[],
): BoardTaskView[] {
  const assigned = columns.flatMap((column) =>
    column.tasks.map((task) => ({
      ...task,
      assigneeName: column.name,
      assigneeRole: column.role,
      assigneeUserId: column.userId,
    })),
  );

  const orphaned = unassigned.map((task) => ({
    ...task,
    assigneeName: "Unassigned",
    assigneeRole: "unassigned" as const,
    assigneeUserId: null,
  }));

  return [...assigned, ...orphaned];
}

function statusSection(
  tasks: BoardTaskView[],
  bucket: WorkflowStatusBucket,
): BoardTaskView[] {
  return tasks.filter((task) => toStatusBucket(task.status) === bucket);
}

function rationaleForTask(task: BoardTaskView): string {
  if (task.phase === "beginning") {
    return "Assigned for early-phase delivery alignment and scope framing.";
  }

  if (task.phase === "middle") {
    return "Assigned for core implementation throughput in active sprint work.";
  }

  return "Assigned for closeout quality and release-readiness coverage.";
}

function laneContextLine(
  laneId: string,
  laneTaskCount: number,
  viewerUserId: string,
): string {
  if (laneId === "unassigned") {
    return "Awaiting owner assignment before delegation is finalized.";
  }

  if (laneId === viewerUserId) {
    return "Personal lane prioritized for your active sprint execution.";
  }

  if (laneTaskCount === 0) {
    return "No active cards in this lane for the current cycle.";
  }

  return "Matched by role fit and recent throughput in related work.";
}

function boardCard(task: BoardTaskView, dense = false) {
  const tone = priorityTone(task);
  const cardLabel = `${task.title}. ${statusLabel(task.status)}. ${dueLabel(task.softDeadline)}`;

  return (
    <article
      key={task.id}
      tabIndex={0}
      aria-label={cardLabel}
      className={`rounded-xl border ${tone.borderTone} bg-[#241d2f] p-3 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${tone.accentDot}`} />
          <div>
            <h4
              className={`text-sm font-bold text-white ${
                task.status === "done"
                  ? "decoration-violet-400/70 line-through"
                  : ""
              }`}
            >
              {task.title}
            </h4>
            <p className="mt-1 text-[11px] text-slate-400">
              {rationaleForTask(task)}
            </p>
          </div>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${statusChipClass(task.status)}`}
        >
          {statusLabel(task.status)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1">
        <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
          {task.phase}
        </span>
        <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
          {task.difficultyPoints} pts
        </span>
      </div>
      {!dense ? (
        <p className="mt-2 text-[10px] font-bold text-violet-300/80">
          {dueLabel(task.softDeadline)}
        </p>
      ) : null}
    </article>
  );
}

export function BoardPage({ projectId, role, viewerUserId }: BoardPageProps) {
  const [mode, setMode] = useState<WorkflowBoardMode>("member_lane");
  const [columns, setColumns] = useState<WorkflowBoardColumnDTO[]>([]);
  const [unassigned, setUnassigned] = useState<WorkflowBoardTaskDTO[]>([]);
  const [capability, setCapability] = useState({
    role,
    canManageProject: role === "admin",
    canEditWorkflow: role === "admin",
  });
  const [project, setProject] = useState<ProjectSummary>(FALLBACK_PROJECT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadBoard() {
      try {
        setLoading(true);
        setError(null);
        setActionMessage(null);

        const [boardResponse, projectResponse] = await Promise.all([
          fetch(`/api/projects/${projectId}/workflow/board`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`/api/projects/${projectId}`, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        if (!boardResponse.ok) {
          throw new Error(`Board endpoint returned ${boardResponse.status}`);
        }

        const boardPayload = parseBoardPayload(
          (await boardResponse.json()) as unknown,
        );
        if (!boardPayload) {
          throw new Error("Board payload missing required fields.");
        }

        const projectPayload = parseProjectPayload(
          (await projectResponse.json()) as unknown,
        );

        if (!cancelled) {
          setColumns(boardPayload.columns);
          setUnassigned(boardPayload.unassigned);
          setCapability(boardPayload.capability);
          setProject(projectPayload ?? FALLBACK_PROJECT);
        }
      } catch (boardError) {
        if (!cancelled) {
          setColumns(FALLBACK_COLUMNS);
          setUnassigned(FALLBACK_UNASSIGNED);
          setProject(FALLBACK_PROJECT);
          setCapability({
            role,
            canManageProject: role === "admin",
            canEditWorkflow: role === "admin",
          });
          setError(
            boardError instanceof Error
              ? `${boardError.message}. Showing fallback board.`
              : "Failed to load board. Showing fallback board.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBoard();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, role]);

  const lanes = useMemo<BoardLane[]>(() => {
    const memberLanes = columns
      .map((column) => ({
        id: column.userId,
        title:
          column.userId === viewerUserId ? `${column.name} (You)` : column.name,
        taskCount: column.tasks.length,
        tasks: column.tasks.map((task) => ({
          ...task,
          assigneeName: column.name,
          assigneeRole: column.role,
          assigneeUserId: column.userId,
        })),
        tone:
          column.userId === viewerUserId
            ? ("viewer" as const)
            : ("neutral" as const),
      }))
      .sort((left, right) => {
        if (left.id === viewerUserId) {
          return -1;
        }
        if (right.id === viewerUserId) {
          return 1;
        }

        return left.title.localeCompare(right.title);
      });

    if (unassigned.length === 0) {
      return memberLanes;
    }

    return [
      ...memberLanes,
      {
        id: "unassigned",
        title: "Unassigned",
        taskCount: unassigned.length,
        tasks: unassigned.map((task) => ({
          ...task,
          assigneeName: "Unassigned",
          assigneeRole: "unassigned",
          assigneeUserId: null,
        })),
        tone: "unassigned",
      },
    ];
  }, [columns, unassigned, viewerUserId]);

  const assigneeSummaries = useMemo<BoardAssigneeSummary[]>(
    () =>
      lanes.map((lane) => {
        const inProgressCount = lane.tasks.filter(
          (task) => task.status === "in_progress",
        ).length;
        const blockedCount = lane.tasks.filter(
          (task) => task.status === "blocked",
        ).length;

        return {
          id: lane.id,
          label: lane.title,
          taskCount: lane.taskCount,
          inProgressCount,
          blockedCount,
          contextLine: laneContextLine(lane.id, lane.taskCount, viewerUserId),
          tone: lane.tone,
        };
      }),
    [lanes, viewerUserId],
  );

  const tasks = useMemo(
    () => flattenBoard(columns, unassigned),
    [columns, unassigned],
  );
  const totalTasks = tasks.length;
  const countdown = deadlineCountdown(project.deadline);
  const canRunDelegationActions = capability.canEditWorkflow;
  const groupedMode = mode === "categorized" || mode === "finalized";

  return (
    <section className="space-y-6 rounded-2xl border border-slate-800 bg-[#18131f] p-5 shadow-[0_18px_60px_rgba(12,10,25,0.45)] md:p-6">
      <header className="space-y-4 rounded-2xl border border-violet-500/25 bg-[#1f1a29] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
              Sprint Board
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-100 md:text-3xl">
              {project.name}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Team delegation board with member lanes, categorized progress, and
              finalized handoff view.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-violet-200">
              AI Engine Active
            </div>
            <div className="flex rounded-lg border border-slate-700 bg-[#17141f] p-1">
              <Link
                href={`/projects/${projectId}/board`}
                className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Board
              </Link>
              <Link
                href={`/projects/${projectId}/timeline`}
                className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Timeline
              </Link>
            </div>
          </div>
        </div>

        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Board modes"
        >
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              id={`board-tab-${option.id}`}
              role="tab"
              aria-controls={`board-panel-${option.id}`}
              aria-selected={mode === option.id}
              tabIndex={mode === option.id ? 0 : -1}
              className={
                mode === option.id
                  ? "rounded-lg border border-violet-400 bg-violet-600/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-violet-200"
                  : "rounded-lg border border-slate-700 bg-[#17141f] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-400 hover:border-violet-500/40 hover:text-slate-200"
              }
              onClick={() => setMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Total Tasks
            </p>
            <p className="mt-1 text-2xl font-black text-violet-300">
              {totalTasks}
            </p>
          </div>
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-300">
              Deadline Countdown
            </p>
            <p className="mt-1 text-xl font-black text-red-200">{countdown}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-[#17141f] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Planning Status
            </p>
            <p className="mt-1 text-sm font-bold text-slate-100">
              {project.planningStatus}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Role: {capability.role} · Edit workflow:{" "}
              {capability.canEditWorkflow ? "yes" : "no"}
            </p>
          </div>
        </div>

        {assigneeSummaries.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {assigneeSummaries.map((summary) => (
              <article
                key={summary.id}
                className={`rounded-xl border p-3 ${
                  summary.tone === "viewer"
                    ? "border-violet-400/45 bg-violet-500/10"
                    : summary.tone === "unassigned"
                      ? "border-amber-400/35 bg-amber-500/10"
                      : "border-slate-700 bg-[#17141f]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-bold text-slate-100">
                    {summary.label}
                  </h2>
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                    {summary.taskCount} tasks
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  {summary.contextLine}
                </p>
                <p className="mt-2 text-[10px] font-semibold text-slate-300">
                  In progress: {summary.inProgressCount} · Blocked:{" "}
                  {summary.blockedCount}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      {actionMessage ? (
        <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {actionMessage}
        </p>
      ) : null}

      {mode === "finalized" ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/20 bg-[#1f1a29] p-3">
          <div className="text-xs text-slate-400">
            Finalized delegation controls are available to project managers.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-700"
              disabled={!canRunDelegationActions}
              onClick={() =>
                setActionMessage(
                  "New task entry is queued for the next board mutation flow.",
                )
              }
            >
              New Task
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-bold text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canRunDelegationActions}
              onClick={() =>
                setActionMessage(
                  "Re-delegation can be triggered after task edits are finalized.",
                )
              }
            >
              Re-Delegate
            </button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <p className="rounded-xl border border-slate-700 bg-[#17141f] px-4 py-3 text-sm text-slate-300">
          Loading board...
        </p>
      ) : lanes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 bg-[#17141f] px-4 py-3 text-sm text-slate-400">
          No member lanes available yet.
        </p>
      ) : (
        <div
          role="tabpanel"
          id={`board-panel-${mode}`}
          aria-labelledby={`board-tab-${mode}`}
          className="overflow-x-auto pb-2"
        >
          <div className="flex min-w-max gap-4">
            {lanes.map((lane) => (
              <section
                key={lane.id}
                className={`w-[260px] rounded-xl border p-3 ${
                  lane.tone === "viewer"
                    ? "border-violet-400/50 bg-[#231c31]"
                    : lane.tone === "unassigned"
                      ? "border-amber-400/45 bg-[#2a1f2b]"
                      : "border-slate-700 bg-[#1a1722]"
                }`}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-100">
                      {lane.title}
                    </h2>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      {lane.taskCount} tasks
                    </p>
                  </div>
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                    {lane.taskCount}
                  </span>
                </div>

                {groupedMode ? (
                  <div className="space-y-3">
                    {STATUS_SECTIONS.map((section) => {
                      const sectionTasks = statusSection(
                        lane.tasks,
                        section.bucket,
                      );

                      if (sectionTasks.length === 0) {
                        return null;
                      }

                      return (
                        <div
                          key={`${lane.id}-${section.bucket}`}
                          className="space-y-2"
                        >
                          <h3 className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                            {section.heading}
                          </h3>
                          <div className="space-y-2">
                            {sectionTasks.map((task) =>
                              boardCard(task, mode === "categorized"),
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {lane.tasks.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-700 px-3 py-3 text-xs text-slate-500">
                        No tasks in this lane.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lane.tasks.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-700 px-3 py-3 text-xs text-slate-500">
                        No tasks in this lane.
                      </p>
                    ) : (
                      lane.tasks.map((task) => boardCard(task))
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      )}

      {mode === "finalized" ? (
        <div className="fixed bottom-6 right-6 z-20">
          <button
            type="button"
            className="rounded-full bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-violet-900/40 disabled:cursor-not-allowed disabled:bg-slate-700"
            disabled={!canRunDelegationActions || totalTasks === 0}
            onClick={() =>
              setActionMessage(
                "Delegation package finalized and ready to send to the project group.",
              )
            }
          >
            Finalize and Send to Group
          </button>
        </div>
      ) : null}
    </section>
  );
}
