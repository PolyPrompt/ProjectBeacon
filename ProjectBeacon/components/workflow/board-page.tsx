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

type DraggedTask = {
  taskId: string;
  fromLaneId: string;
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
  deadline: "2026-03-15T00:00:00.000Z",
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
        softDeadline: "2026-03-04T00:00:00.000Z",
        difficultyPoints: 5,
        phase: "beginning",
      },
      {
        id: "t_board_2",
        title: "Scale Inference Engine",
        status: "in_progress",
        softDeadline: "2026-03-03T00:00:00.000Z",
        difficultyPoints: 8,
        phase: "middle",
      },
    ],
  },
  {
    userId: "user_002",
    name: "Sarah",
    email: "sarah@example.edu",
    role: "user",
    tasks: [
      {
        id: "t_board_3",
        title: "Mobile Responsiveness Audit",
        status: "done",
        softDeadline: "2026-03-05T00:00:00.000Z",
        difficultyPoints: 3,
        phase: "end",
      },
    ],
  },
  {
    userId: "user_003",
    name: "Jordan",
    email: "jordan@example.edu",
    role: "user",
    tasks: [
      {
        id: "t_board_3",
        title: "Dataset Cleaning Pipeline",
        status: "blocked",
        softDeadline: "2026-03-06T00:00:00.000Z",
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

function dueLabel(value: string | null, nowMs: number | null): string {
  if (!value) {
    return "Suggested deadline: TBD";
  }

  const due = new Date(value).getTime();
  if (Number.isNaN(due)) {
    return "Suggested deadline: invalid date";
  }

  if (nowMs === null) {
    return `Suggested deadline: ${value.slice(0, 10)}`;
  }

  const diffHours = Math.ceil((due - nowMs) / (1000 * 60 * 60));
  if (diffHours <= 0) {
    return "Suggested deadline: today";
  }

  const diffDays = Math.ceil(diffHours / 24);
  return `Suggested deadline: ${diffDays}d`;
}

function deadlineCountdown(deadlineIso: string, nowMs: number | null): string {
  if (nowMs === null) {
    return "--d : --h : --m";
  }

  const target = new Date(deadlineIso).getTime();
  if (Number.isNaN(target)) {
    return "Unknown";
  }

  const totalMinutes = Math.max(0, Math.floor((target - nowMs) / (1000 * 60)));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return `${String(days).padStart(2, "0")}d : ${String(hours).padStart(2, "0")}h : ${String(minutes).padStart(2, "0")}m`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
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

function moveTaskBetweenLanes(
  sourceColumns: WorkflowBoardColumnDTO[],
  sourceUnassigned: WorkflowBoardTaskDTO[],
  taskId: string,
  fromLaneId: string,
  toLaneId: string,
  forceTodo: boolean,
): {
  columns: WorkflowBoardColumnDTO[];
  unassigned: WorkflowBoardTaskDTO[];
} | null {
  if (fromLaneId === toLaneId) {
    return {
      columns: sourceColumns,
      unassigned: sourceUnassigned,
    };
  }

  const nextColumns = sourceColumns.map((column) => ({
    ...column,
    tasks: [...column.tasks],
  }));
  const nextUnassigned = [...sourceUnassigned];

  let movedTask: WorkflowBoardTaskDTO | null = null;

  if (fromLaneId === "unassigned") {
    const sourceIndex = nextUnassigned.findIndex((task) => task.id === taskId);
    if (sourceIndex >= 0) {
      const [task] = nextUnassigned.splice(sourceIndex, 1);
      movedTask = task;
    }
  } else {
    const sourceLane = nextColumns.find(
      (column) => column.userId === fromLaneId,
    );
    if (sourceLane) {
      const sourceIndex = sourceLane.tasks.findIndex(
        (task) => task.id === taskId,
      );
      if (sourceIndex >= 0) {
        const [task] = sourceLane.tasks.splice(sourceIndex, 1);
        movedTask = task;
      }
    }
  }

  if (!movedTask) {
    return null;
  }

  const nextTask = forceTodo
    ? { ...movedTask, status: "todo" as const }
    : movedTask;

  if (toLaneId === "unassigned") {
    nextUnassigned.push(nextTask);
    return {
      columns: nextColumns,
      unassigned: nextUnassigned,
    };
  }

  const targetLane = nextColumns.find((column) => column.userId === toLaneId);
  if (!targetLane) {
    return null;
  }

  targetLane.tasks.push(nextTask);
  return {
    columns: nextColumns,
    unassigned: nextUnassigned,
  };
}

function boardCard(
  task: BoardTaskView,
  nowMs: number | null,
  dense = false,
  draggable = false,
  onDragStart?: (taskId: string) => void,
  onDragEnd?: () => void,
) {
  const tone = priorityTone(task);
  const cardLabel = `${task.title}. ${statusLabel(task.status)}. ${dueLabel(task.softDeadline, nowMs)}`;
  const completedDots =
    task.status === "done"
      ? 3
      : task.status === "in_progress"
        ? 2
        : task.status === "blocked"
          ? 2
          : 1;

  return (
    <article
      key={task.id}
      draggable={draggable}
      tabIndex={0}
      aria-label={cardLabel}
      className={`rounded-lg border ${tone.borderTone} bg-[#241d2f] p-3 shadow-sm transition hover:border-violet-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      onDragStart={() => onDragStart?.(task.id)}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start justify-between gap-2">
        <h4
          className={`text-sm font-bold leading-tight text-slate-100 ${
            task.status === "done"
              ? "line-through decoration-violet-500/70"
              : ""
          }`}
        >
          {task.title}
        </h4>
        <div className="mt-1 flex gap-1">
          {Array.from({ length: 3 }, (_, index) => (
            <span
              key={`${task.id}-dot-${index}`}
              className={`h-2 w-2 rounded-full ${
                index < completedDots ? tone.accentDot : "bg-slate-600"
              }`}
            />
          ))}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-slate-400">
        {rationaleForTask(task)}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${statusChipClass(task.status)}`}
        >
          {statusLabel(task.status)}
        </span>
        {!dense ? (
          <p className="text-[10px] font-semibold text-slate-500">
            {dueLabel(task.softDeadline, nowMs)}
          </p>
        ) : (
          <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
            {task.difficultyPoints} pts
          </span>
        )}
      </div>
      {dense ? (
        <p className="mt-2 text-[10px] font-semibold text-violet-300/80">
          {dueLabel(task.softDeadline, nowMs)}
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
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<DraggedTask | null>(null);
  const [dropLaneId, setDropLaneId] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setNowMs(Date.now());
    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

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
  }, [projectId, role, viewerUserId, reloadToken]);

  const isDraftPlanning = project.planningStatus === "draft";
  const modeOptions = isDraftPlanning
    ? MODE_OPTIONS.filter((option) => option.id === "member_lane")
    : MODE_OPTIONS;

  useEffect(() => {
    if (isDraftPlanning && mode !== "member_lane") {
      setMode("member_lane");
    }
  }, [isDraftPlanning, mode]);

  const lanes = useMemo<BoardLane[]>(() => {
    const memberLanes = columns
      .map((column) => ({
        id: column.userId,
        title:
          column.userId === viewerUserId ? `${column.name} (You)` : column.name,
        taskCount: column.tasks.length,
        tasks: column.tasks.map((task) => {
          const status = isDraftPlanning ? ("todo" as const) : task.status;
          return {
            ...task,
            status,
            assigneeName: column.name,
            assigneeRole: column.role,
            assigneeUserId: column.userId,
          };
        }),
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
        tasks: unassigned.map((task) => {
          const status = isDraftPlanning ? ("todo" as const) : task.status;
          return {
            ...task,
            status,
            assigneeName: "Unassigned",
            assigneeRole: "unassigned",
            assigneeUserId: null,
          };
        }),
        tone: "unassigned",
      },
    ];
  }, [columns, isDraftPlanning, unassigned, viewerUserId]);

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
  const countdown = deadlineCountdown(project.deadline, nowMs);
  const canRunDelegationActions = capability.canEditWorkflow;
  const groupedMode =
    !isDraftPlanning && (mode === "categorized" || mode === "finalized");
  const viewerName =
    columns.find((column) => column.userId === viewerUserId)?.name ??
    "Team Member";
  const viewerInitials = initialsFromName(viewerName);

  async function readErrorMessage(response: Response): Promise<string> {
    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (payload?.error?.message) {
        return payload.error.message;
      }
    } catch {
      // Ignore JSON parse failures and use default fallback below.
    }
    return `Request failed (${response.status})`;
  }

  async function handleLaneDrop(targetLaneId: string) {
    if (!draggedTask || !canRunDelegationActions) {
      return;
    }

    const { taskId, fromLaneId } = draggedTask;
    setDraggedTask(null);
    setDropLaneId(null);

    if (fromLaneId === targetLaneId) {
      return;
    }

    const previousColumns = columns;
    const previousUnassigned = unassigned;
    const movedState = moveTaskBetweenLanes(
      columns,
      unassigned,
      taskId,
      fromLaneId,
      targetLaneId,
      isDraftPlanning,
    );

    if (!movedState) {
      return;
    }

    setColumns(movedState.columns);
    setUnassigned(movedState.unassigned);
    setError(null);
    setActionMessage(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assigneeUserId: targetLaneId === "unassigned" ? null : targetLaneId,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setActionMessage("Task moved.");
    } catch (moveError) {
      setColumns(previousColumns);
      setUnassigned(previousUnassigned);
      setError(
        moveError instanceof Error
          ? moveError.message
          : "Failed to move task between team members.",
      );
    }
  }

  async function finalizeAndSend() {
    if (!canRunDelegationActions || totalTasks === 0 || isFinalizing) {
      return;
    }

    setIsFinalizing(true);
    setError(null);
    setActionMessage(null);

    try {
      let workingStatus = project.planningStatus;

      if (workingStatus === "draft") {
        const lockResponse = await fetch(
          `/api/projects/${projectId}/planning/lock`,
          {
            method: "POST",
          },
        );

        if (!lockResponse.ok) {
          throw new Error(await readErrorMessage(lockResponse));
        }

        workingStatus = "locked";
      }

      if (workingStatus === "locked") {
        const assignResponse = await fetch(
          `/api/projects/${projectId}/assignments/run`,
          {
            method: "POST",
          },
        );

        if (!assignResponse.ok) {
          throw new Error(await readErrorMessage(assignResponse));
        }
      }

      setActionMessage("Delegation package finalized and sent to the group.");
      setReloadToken((current) => current + 1);
    } catch (finalizeError) {
      setError(
        finalizeError instanceof Error
          ? finalizeError.message
          : "Failed to finalize and send delegation.",
      );
    } finally {
      setIsFinalizing(false);
    }
  }

  return (
    <section className="h-screen overflow-hidden bg-[#18131f] text-slate-100">
      <div className="flex h-full overflow-hidden">
        <aside className="hidden w-64 shrink-0 border-r border-violet-500/20 bg-[#161220] px-4 py-6 lg:flex lg:flex-col">
          <div className="mb-10 flex items-center gap-3 px-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-violet-600 text-sm font-bold text-white">
              NU
            </div>
            <p className="text-2xl font-extrabold tracking-tight">Nexus UI</p>
          </div>

          <nav className="space-y-2">
            <div className="flex items-center gap-3 rounded-lg bg-violet-500/20 px-3 py-3 text-violet-200">
              <span className="text-xs font-bold">TB</span>
              <span className="font-semibold">Team Board</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg px-3 py-3 text-slate-400">
              <span className="text-xs font-bold">IN</span>
              <span className="font-semibold">Insights</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg px-3 py-3 text-slate-400">
              <span className="text-xs font-bold">DR</span>
              <span className="font-semibold">Directory</span>
            </div>
            <div className="flex items-center gap-3 rounded-lg px-3 py-3 text-slate-400">
              <span className="text-xs font-bold">DS</span>
              <span className="font-semibold">Discussions</span>
            </div>
          </nav>

          <div className="mt-auto border-t border-violet-500/15 pt-5">
            <div className="flex items-center gap-3 rounded-lg px-3 py-3 text-slate-400">
              <span className="text-xs font-bold">ST</span>
              <span className="font-semibold">Settings</span>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-16 items-center justify-between border-b border-violet-500/20 bg-[#161220]/70 px-6 backdrop-blur lg:px-8">
            <div className="flex items-center gap-6">
              <h2 className="text-lg font-bold tracking-tight">
                {project.name}
              </h2>
              <div className="hidden items-center gap-2 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 md:flex">
                <span className="text-xs text-slate-400">Search</span>
                <input
                  className="w-44 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
                  placeholder="Find a task..."
                  type="text"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                aria-label="Notifications"
                className="relative rounded-lg p-2 text-slate-300 hover:bg-violet-500/10"
                type="button"
              >
                <span className="text-base font-bold">!</span>
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
              </button>
              <div className="h-8 w-px bg-violet-500/20" />
              <div className="hidden text-right sm:block">
                <p className="text-xs font-bold leading-none">{viewerName}</p>
                <p className="text-[10px] text-slate-500">
                  {capability.role === "admin" ? "Admin View" : "Member View"}
                </p>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-violet-400/40 bg-[#241d2f] text-xs font-bold text-slate-100">
                {viewerInitials}
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="space-y-4 px-6 pb-4 pt-6 lg:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-5xl font-black tracking-tight text-slate-100">
                    Team Task Overview
                  </h1>
                  <p className="mt-1 text-2xl font-medium text-slate-400">
                    Standard internal view • Updated 5 mins ago
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <article className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Total Tasks
                    </p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <p className="text-3xl font-black text-slate-100">
                        {totalTasks}
                      </p>
                      <p className="text-xs font-bold text-emerald-400">+2%</p>
                    </div>
                  </article>
                  <article className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-300">
                      Deadline Countdown
                    </p>
                    <p className="mt-1 text-3xl font-black tracking-tight text-rose-200">
                      {countdown}
                    </p>
                  </article>
                  {project.planningStatus !== "assigned" ? (
                    <button
                      type="button"
                      className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/40 disabled:cursor-not-allowed disabled:bg-slate-700"
                      disabled={
                        !canRunDelegationActions ||
                        totalTasks === 0 ||
                        isFinalizing
                      }
                      onClick={() => void finalizeAndSend()}
                    >
                      {isFinalizing ? "Sending..." : "Complete and Send Out"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {isDraftPlanning ? (
                  <p className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100">
                    Draft mode: tasks are shown as Not Started and organized by
                    member lanes only.
                  </p>
                ) : (
                  <div
                    className="flex flex-wrap gap-2"
                    role="tablist"
                    aria-label="Board modes"
                  >
                    {modeOptions.map((option) => (
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
                )}

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

              {assigneeSummaries.length > 0 ? (
                <div className="hidden gap-2 md:grid md:grid-cols-2 xl:grid-cols-4">
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
                          {summary.taskCount}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {summary.contextLine}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}

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
            </div>

            <div className="min-h-0 flex-1 overflow-x-auto px-6 pb-6 lg:px-8">
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
                  className="h-full"
                >
                  <div className="flex h-full min-w-max gap-5">
                    {lanes.map((lane) => (
                      <section
                        key={lane.id}
                        className={`flex h-full min-h-[520px] w-[310px] flex-col rounded-xl border p-3 ${
                          lane.tone === "viewer"
                            ? "border-violet-400/50 bg-[#231c31]"
                            : lane.tone === "unassigned"
                              ? "border-amber-400/45 bg-[#2a1f2b]"
                              : "border-slate-700 bg-[#111532]"
                        } ${
                          dropLaneId === lane.id && draggedTask
                            ? "ring-2 ring-violet-400 ring-offset-1 ring-offset-[#100d19]"
                            : ""
                        }`}
                        onDragOver={(event) => {
                          if (!canRunDelegationActions || !draggedTask) {
                            return;
                          }
                          event.preventDefault();
                          setDropLaneId(lane.id);
                        }}
                        onDragLeave={() => {
                          if (dropLaneId === lane.id) {
                            setDropLaneId(null);
                          }
                        }}
                        onDrop={(event) => {
                          if (!canRunDelegationActions || !draggedTask) {
                            return;
                          }
                          event.preventDefault();
                          void handleLaneDrop(lane.id);
                        }}
                      >
                        <div className="mb-3 flex items-center justify-between gap-2 px-1">
                          <div className="flex items-center gap-2">
                            <h2
                              className={`text-xl font-bold ${
                                lane.tone === "viewer"
                                  ? "text-violet-300"
                                  : "text-slate-100"
                              }`}
                            >
                              {lane.title}
                            </h2>
                            <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-200">
                              {lane.taskCount}
                            </span>
                          </div>
                          <span className="text-slate-500">...</span>
                        </div>

                        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
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
                                        boardCard(
                                          task,
                                          nowMs,
                                          mode === "categorized",
                                          canRunDelegationActions,
                                          (taskId) =>
                                            setDraggedTask({
                                              taskId,
                                              fromLaneId: lane.id,
                                            }),
                                          () => {
                                            setDraggedTask(null);
                                            setDropLaneId(null);
                                          },
                                        ),
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
                          ) : lane.tasks.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-slate-700 px-3 py-3 text-xs text-slate-500">
                              No tasks in this lane.
                            </p>
                          ) : (
                            lane.tasks.map((task) =>
                              boardCard(
                                task,
                                nowMs,
                                false,
                                canRunDelegationActions,
                                (taskId) =>
                                  setDraggedTask({
                                    taskId,
                                    fromLaneId: lane.id,
                                  }),
                                () => {
                                  setDraggedTask(null);
                                  setDropLaneId(null);
                                },
                              ),
                            )
                          )}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}
