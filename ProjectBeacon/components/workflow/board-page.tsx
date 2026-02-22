"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { TaskDetailModal } from "@/components/dashboard/task-detail-modal";
import { isProjectComplete } from "@/lib/projects/completion";
import type { MyTaskDTO } from "@/types/dashboard";
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
  showProjectSummaryLink?: boolean;
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

function difficultyDotCount(task: WorkflowBoardTaskDTO): number {
  if (task.difficultyPoints >= 5) {
    return 3;
  }

  if (task.difficultyPoints >= 3) {
    return 2;
  }

  return 1;
}

function difficultyDotColorClass(dotCount: number): string {
  if (dotCount >= 3) {
    return "bg-violet-700";
  }

  if (dotCount === 2) {
    return "bg-violet-500";
  }

  return "bg-violet-300";
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
    return "--d : --h : --m : --s";
  }

  const target = new Date(deadlineIso).getTime();
  if (Number.isNaN(target)) {
    return "Unknown";
  }

  const totalSeconds = Math.max(0, Math.floor((target - nowMs) / 1000));
  const days = Math.floor(totalSeconds / (60 * 60 * 24));
  const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  return `${String(days).padStart(2, "0")}d : ${String(hours).padStart(2, "0")}h : ${String(minutes).padStart(2, "0")}m : ${String(seconds).padStart(2, "0")}s`;
}

function LiveBoardDeadlineCountdown({ deadlineIso }: { deadlineIso: string }) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return <>{deadlineCountdown(deadlineIso, nowMs)}</>;
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

function setTaskStatusInBoard(
  sourceColumns: WorkflowBoardColumnDTO[],
  sourceUnassigned: WorkflowBoardTaskDTO[],
  taskId: string,
  status: WorkflowBoardTaskDTO["status"],
): {
  columns: WorkflowBoardColumnDTO[];
  unassigned: WorkflowBoardTaskDTO[];
} {
  return {
    columns: sourceColumns.map((column) => ({
      ...column,
      tasks: column.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status,
            }
          : task,
      ),
    })),
    unassigned: sourceUnassigned.map((task) =>
      task.id === taskId
        ? {
            ...task,
            status,
          }
        : task,
    ),
  };
}

function boardCard(
  task: BoardTaskView,
  nowMs: number | null,
  dense = false,
  draggable = false,
  onOpenTask?: (taskId: string) => void,
  onDragStart?: (taskId: string) => void,
  onDragEnd?: () => void,
  onMarkComplete?: (taskId: string) => void,
  isCompleting = false,
) {
  const cardLabel = `${task.title}. ${statusLabel(task.status)}. ${dueLabel(task.softDeadline, nowMs)}`;
  const difficultyDots = difficultyDotCount(task);
  const activeDifficultyDotClass = difficultyDotColorClass(difficultyDots);
  const canMarkComplete = Boolean(onMarkComplete) && task.status !== "done";

  return (
    <article
      key={task.id}
      draggable={draggable}
      tabIndex={0}
      aria-label={cardLabel}
      className={`rounded-lg border border-slate-700 bg-[#241d2f] p-3 shadow-sm transition hover:border-violet-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
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
                index < difficultyDots
                  ? activeDifficultyDotClass
                  : "bg-slate-600"
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
      <div className="mt-3 flex items-center justify-between gap-2">
        {canMarkComplete ? (
          <button
            type="button"
            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCompleting}
            onClick={(event) => {
              event.stopPropagation();
              onMarkComplete?.(task.id);
            }}
          >
            {isCompleting ? "Saving..." : "Complete Task"}
          </button>
        ) : (
          <span className="text-[10px] font-semibold text-emerald-300/80">
            {task.status === "done" ? "Completed" : ""}
          </span>
        )}
        <button
          type="button"
          className="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200 hover:bg-violet-500/20"
          onClick={(event) => {
            event.stopPropagation();
            onOpenTask?.(task.id);
          }}
        >
          Open Task
        </button>
      </div>
    </article>
  );
}

export function BoardPage({
  projectId,
  role,
  showProjectSummaryLink = false,
  viewerUserId,
}: BoardPageProps) {
  const router = useRouter();
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [createTaskLaneId, setCreateTaskLaneId] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isAssigningUnassigned, setIsAssigningUnassigned] = useState(false);
  const [completingTaskIds, setCompletingTaskIds] = useState<string[]>([]);
  const previousProjectCompleteRef = useRef<boolean | null>(null);

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

  const tasks = useMemo(
    () => flattenBoard(columns, unassigned),
    [columns, unassigned],
  );
  const projectIsComplete = useMemo(
    () => isProjectComplete(tasks.map((task) => task.status)),
    [tasks],
  );
  const canShowProjectSummaryLink = showProjectSummaryLink && projectIsComplete;
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );
  const unassignedTodoCount = useMemo(
    () => unassigned.filter((task) => task.status === "todo").length,
    [unassigned],
  );
  const totalTasks = tasks.length;
  const canRunDelegationActions =
    capability.canEditWorkflow || capability.role === "user";
  const canAssignUnassignedTasks =
    capability.canManageProject && unassignedTodoCount > 0;
  const groupedMode =
    !isDraftPlanning && (mode === "categorized" || mode === "finalized");
  const activeCreateLane =
    createTaskLaneId === null
      ? null
      : (lanes.find((lane) => lane.id === createTaskLaneId) ?? null);

  useEffect(() => {
    if (loading || completingTaskIds.length > 0) {
      return;
    }

    if (previousProjectCompleteRef.current === null) {
      previousProjectCompleteRef.current = projectIsComplete;
      return;
    }

    if (!previousProjectCompleteRef.current && projectIsComplete) {
      router.replace(`/projects/${projectId}/complete`);
      return;
    }

    previousProjectCompleteRef.current = projectIsComplete;
  }, [completingTaskIds, loading, projectId, projectIsComplete, router]);

  function openCreateTaskModal(preferredLaneId?: string): void {
    const selectedLaneId =
      preferredLaneId && lanes.some((lane) => lane.id === preferredLaneId)
        ? preferredLaneId
        : (lanes.find((lane) => lane.id === viewerUserId)?.id ??
          lanes.find((lane) => lane.id !== "unassigned")?.id ??
          lanes[0]?.id ??
          null);

    if (!selectedLaneId) {
      return;
    }

    setError(null);
    setActionMessage(null);
    setCreateTaskLaneId(selectedLaneId);
  }

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

  async function handleTaskComplete(taskId: string): Promise<void> {
    if (isDraftPlanning) {
      return;
    }

    if (completingTaskIds.includes(taskId)) {
      return;
    }

    const existingTask = tasks.find((task) => task.id === taskId);
    if (!existingTask || existingTask.status === "done") {
      return;
    }

    const previousColumns = columns;
    const previousUnassigned = unassigned;
    const optimisticState = setTaskStatusInBoard(
      columns,
      unassigned,
      taskId,
      "done",
    );

    setColumns(optimisticState.columns);
    setUnassigned(optimisticState.unassigned);
    setCompletingTaskIds((current) =>
      current.includes(taskId) ? current : [...current, taskId],
    );
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
            status: "done",
          }),
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      setActionMessage("Task completed and saved.");
    } catch (completeError) {
      setColumns(previousColumns);
      setUnassigned(previousUnassigned);
      setError(
        completeError instanceof Error
          ? completeError.message
          : "Failed to complete task.",
      );
    } finally {
      setCompletingTaskIds((current) =>
        current.filter((currentTaskId) => currentTaskId !== taskId),
      );
    }
  }

  async function createTaskFromModal(
    draft: Pick<
      MyTaskDTO,
      "title" | "description" | "status" | "difficultyPoints" | "softDeadline"
    >,
  ): Promise<void> {
    if (!activeCreateLane) {
      return;
    }

    if (isCreatingTask) {
      return;
    }

    const title = draft.title.trim();
    if (title.length === 0) {
      setError("Task title is required.");
      return;
    }

    setIsCreatingTask(true);
    setError(null);
    setActionMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description: draft.description,
          difficultyPoints: draft.difficultyPoints,
          dueAt: draft.softDeadline,
          assigneeUserId:
            activeCreateLane.id === "unassigned" ? null : activeCreateLane.id,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = (await response.json()) as {
        task?: { id?: string };
      };
      const createdTaskId = payload.task?.id ?? null;

      if (draft.status !== "todo" && createdTaskId) {
        const statusResponse = await fetch(
          `/api/projects/${projectId}/tasks/${createdTaskId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: draft.status,
            }),
          },
        );

        if (!statusResponse.ok) {
          throw new Error(await readErrorMessage(statusResponse));
        }
      }

      setCreateTaskLaneId(null);
      setActionMessage("Task added.");
      setReloadToken((current) => current + 1);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create task.",
      );
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function handleAssignUnassignedTasks() {
    if (!canAssignUnassignedTasks || isAssigningUnassigned) {
      return;
    }

    try {
      setIsAssigningUnassigned(true);
      setError(null);
      setActionMessage(null);

      const response = await fetch(
        `/api/projects/${projectId}/assignments/assign-unassigned`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = (await response.json()) as {
        assignedCount?: number;
        assignmentMode?: "openai" | "deterministic" | "none";
      };
      const assignedCount =
        typeof payload.assignedCount === "number" ? payload.assignedCount : 0;
      const mode = payload.assignmentMode;

      if (assignedCount === 0 || mode === "none") {
        setActionMessage("No unassigned todo tasks needed assignment.");
      } else if (mode === "openai") {
        setActionMessage(
          `Assigned ${assignedCount} unassigned task${assignedCount === 1 ? "" : "s"} using AI.`,
        );
      } else {
        setActionMessage(
          `Assigned ${assignedCount} unassigned task${assignedCount === 1 ? "" : "s"} using deterministic fallback.`,
        );
      }

      setReloadToken((current) => current + 1);
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : "Failed to assign unassigned tasks.",
      );
    } finally {
      setIsAssigningUnassigned(false);
    }
  }

  return (
    <section className="h-full overflow-auto bg-[#18131f] text-slate-100">
      <div className="h-full">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-4 px-6 pb-4 pt-6 lg:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="text-5xl font-black tracking-tight text-slate-100">
                    Team Task Overview
                  </h1>
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
                    </div>
                  </article>
                  <article className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rose-300">
                      Deadline Countdown
                    </p>
                    <p className="mt-1 text-3xl font-black tracking-tight text-rose-200">
                      <LiveBoardDeadlineCountdown
                        deadlineIso={project.deadline}
                      />
                    </p>
                  </article>
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

                <div className="flex items-center gap-2">
                  {canShowProjectSummaryLink ? (
                    <Link
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-emerald-200 hover:bg-emerald-500/20"
                      href={`/projects/${projectId}/complete`}
                    >
                      Go to Project Summary
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-violet-200 hover:bg-violet-500/20"
                    onClick={() => openCreateTaskModal()}
                  >
                    New Task
                  </button>

                  {canAssignUnassignedTasks ? (
                    <button
                      type="button"
                      className="rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isAssigningUnassigned}
                      onClick={() => {
                        void handleAssignUnassignedTasks();
                      }}
                    >
                      {isAssigningUnassigned
                        ? "Assigning..."
                        : "Assign Unassigned Tasks"}
                    </button>
                  ) : null}

                  <div className="flex rounded-lg border border-slate-700 bg-[#17141f] p-1">
                    <Link
                      href={`/projects/${projectId}/userflow/board`}
                      className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Board
                    </Link>
                    <Link
                      href={`/projects/${projectId}/userflow/timeline`}
                      className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                    >
                      Timeline
                    </Link>
                  </div>
                </div>
              </div>

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
                          {lane.id !== "unassigned" ? (
                            <button
                              type="button"
                              className="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200 hover:bg-violet-500/20"
                              onClick={() => {
                                openCreateTaskModal(lane.id);
                              }}
                            >
                              + Task
                            </button>
                          ) : (
                            <span className="text-slate-500">...</span>
                          )}
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
                                          (taskId) => {
                                            setCreateTaskLaneId(null);
                                            setSelectedTaskId(taskId);
                                          },
                                          (taskId) =>
                                            setDraggedTask({
                                              taskId,
                                              fromLaneId: lane.id,
                                            }),
                                          () => {
                                            setDraggedTask(null);
                                            setDropLaneId(null);
                                          },
                                          isDraftPlanning
                                            ? undefined
                                            : (taskId) => {
                                                void handleTaskComplete(taskId);
                                              },
                                          completingTaskIds.includes(task.id),
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
                                (taskId) => {
                                  setCreateTaskLaneId(null);
                                  setSelectedTaskId(taskId);
                                },
                                (taskId) =>
                                  setDraggedTask({
                                    taskId,
                                    fromLaneId: lane.id,
                                  }),
                                () => {
                                  setDraggedTask(null);
                                  setDropLaneId(null);
                                },
                                isDraftPlanning
                                  ? undefined
                                  : (taskId) => {
                                      void handleTaskComplete(taskId);
                                    },
                                completingTaskIds.includes(task.id),
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
      {activeCreateLane ? (
        <TaskDetailModal
          createAssigneeLabel={activeCreateLane.title}
          mode="create"
          onClose={() => {
            if (isCreatingTask) {
              return;
            }
            setCreateTaskLaneId(null);
          }}
          onTaskCreate={createTaskFromModal}
          projectId={projectId}
          userIdHeaderValue={viewerUserId}
        />
      ) : null}
      {selectedTask ? (
        <TaskDetailModal
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdate={(taskId, patch) => {
            setColumns((currentColumns) =>
              currentColumns.map((column) => ({
                ...column,
                tasks: column.tasks.map((task) =>
                  task.id === taskId
                    ? {
                        ...task,
                        title: patch.title ?? task.title,
                        status: patch.status ?? task.status,
                        softDeadline:
                          patch.softDeadline === undefined
                            ? task.softDeadline
                            : patch.softDeadline,
                        difficultyPoints:
                          patch.difficultyPoints ?? task.difficultyPoints,
                      }
                    : task,
                ),
              })),
            );
            setUnassigned((currentUnassigned) =>
              currentUnassigned.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      title: patch.title ?? task.title,
                      status: patch.status ?? task.status,
                      softDeadline:
                        patch.softDeadline === undefined
                          ? task.softDeadline
                          : patch.softDeadline,
                      difficultyPoints:
                        patch.difficultyPoints ?? task.difficultyPoints,
                    }
                  : task,
              ),
            );
          }}
          projectId={projectId}
          task={{
            id: selectedTask.id,
            title: selectedTask.title,
            description: "",
            status: selectedTask.status,
            softDeadline: selectedTask.softDeadline,
            difficultyPoints: selectedTask.difficultyPoints,
            assigneeUserId: selectedTask.assigneeUserId,
            createdAt: null,
          }}
          userIdHeaderValue={viewerUserId}
        />
      ) : null}
    </section>
  );
}
