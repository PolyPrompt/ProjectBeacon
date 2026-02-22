"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  MyTaskDTO,
  TaskDetailModalDTO,
  TaskStatus,
} from "@/types/dashboard";

type TimelineEvent = {
  id: string;
  label: string;
  timestamp: string;
  tone: "primary" | "warning";
};

type TaskDetailModalProps = {
  projectId: string;
  task: (MyTaskDTO & { createdAt?: string | null }) | null;
  userIdHeaderValue: string;
  onClose: () => void;
  onTaskStatusChange: (taskId: string, status: TaskStatus) => void;
};

function toReadableDate(value: string | null): string {
  if (!value) {
    return "No date available";
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

function createFallbackDetail(
  projectId: string,
  task: MyTaskDTO,
): TaskDetailModalDTO {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    softDeadline: task.softDeadline,
    assignmentReasoning:
      "Matched to your current workflow lane based on assignment ownership and active project priority.",
    dependencyTaskIds: [],
    timelineTaskUrl: `/projects/${projectId}/timeline?taskId=${task.id}`,
    timelinePlacement: {
      phase: "middle",
      sequenceIndex: 1,
      totalTasks: 1,
    },
  };
}

function isTaskDetailModalDTO(value: unknown): value is TaskDetailModalDTO {
  if (!value || typeof value !== "object") {
    return false;
  }

  const detail = value as Record<string, unknown>;
  return (
    typeof detail.id === "string" &&
    typeof detail.title === "string" &&
    typeof detail.description === "string" &&
    (detail.status === "todo" ||
      detail.status === "in_progress" ||
      detail.status === "blocked" ||
      detail.status === "done") &&
    (typeof detail.softDeadline === "string" || detail.softDeadline === null) &&
    typeof detail.assignmentReasoning === "string" &&
    Array.isArray(detail.dependencyTaskIds) &&
    typeof detail.timelineTaskUrl === "string" &&
    !!detail.timelinePlacement &&
    typeof detail.timelinePlacement === "object"
  );
}

function timelineEventsForDetail(
  detail: TaskDetailModalDTO,
  createdAt: string | null,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (detail.status === "in_progress") {
    events.push({
      id: "status-in-progress",
      label: "Moved to In Progress",
      timestamp: "Current",
      tone: "warning",
    });
  } else if (detail.status === "blocked") {
    events.push({
      id: "status-blocked",
      label: "Marked as Blocked",
      timestamp: "Current",
      tone: "warning",
    });
  } else if (detail.status === "done") {
    events.push({
      id: "status-done",
      label: "Marked Completed",
      timestamp: "Current",
      tone: "primary",
    });
  }

  events.push({
    id: "created",
    label: "Task Created",
    timestamp: toReadableDate(createdAt),
    tone: "primary",
  });

  return events;
}

export function TaskDetailModal({
  projectId,
  task,
  userIdHeaderValue,
  onClose,
  onTaskStatusChange,
}: TaskDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetailModalDTO | null>(null);
  const [statusDraft, setStatusDraft] = useState<TaskStatus | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [backupRequested, setBackupRequested] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const fallback = useMemo(
    () => (task ? createFallbackDetail(projectId, task) : null),
    [projectId, task],
  );

  const activeDetail = detail ?? fallback;
  const currentStatus = statusDraft ?? activeDetail?.status ?? null;

  useEffect(() => {
    if (!task) {
      setDetail(null);
      setStatusDraft(null);
      setError(null);
      setBackupRequested(false);
      return;
    }

    const activeTask = task;
    let cancelled = false;
    const controller = new AbortController();

    async function loadTaskDetail() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/projects/${projectId}/tasks/${activeTask.id}/detail`,
          {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
            headers: {
              "x-user-id": userIdHeaderValue,
            },
          },
        );

        if (!response.ok) {
          throw new Error(`Task detail endpoint returned ${response.status}`);
        }

        const data = (await response.json()) as unknown;

        if (!cancelled) {
          if (isTaskDetailModalDTO(data)) {
            setDetail(data);
            setStatusDraft(data.status);
          } else {
            setDetail(fallback);
            setStatusDraft(fallback?.status ?? null);
            setError(
              "Task detail payload is incomplete. Showing scaffold detail.",
            );
          }
        }
      } catch (fetchError) {
        if (!cancelled) {
          setDetail(fallback);
          setStatusDraft(fallback?.status ?? null);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load task detail. Showing scaffold detail.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTaskDetail();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fallback, projectId, task, userIdHeaderValue]);

  useEffect(() => {
    if (!task) {
      return;
    }

    const previousActive = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    const onTabTrap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !modalRef.current) {
        return;
      }

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", onEscape);
    document.addEventListener("keydown", onTabTrap);

    return () => {
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("keydown", onTabTrap);
      previousActive?.focus();
    };
  }, [onClose, task]);

  if (!task || !activeDetail) {
    return null;
  }

  const statusTimeline = timelineEventsForDetail(
    activeDetail,
    task.createdAt ?? null,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-violet-500/30 bg-[#1e1926] text-slate-100 shadow-2xl shadow-violet-900/35"
        ref={modalRef}
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-violet-900/40 p-5">
          <h2 className="text-xl font-semibold">Task Details</h2>
          <button
            className="rounded-md border border-violet-700/60 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-violet-900/30"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="grid max-h-[calc(90vh-76px)] gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-5 border-b border-violet-900/40 p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-2xl font-semibold text-white">
                {activeDetail.title}
              </h3>
              <span className="rounded bg-violet-500/15 px-2 py-1 text-[10px] font-bold uppercase text-violet-200">
                {activeDetail.timelinePlacement.phase}
              </span>
            </div>

            {loading ? (
              <p className="rounded-lg bg-violet-900/30 px-3 py-2 text-sm text-violet-100">
                Loading task detail...
              </p>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {error}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Priority
                </p>
                <p className="mt-1 rounded-lg border border-violet-900/40 bg-violet-900/20 px-3 py-2 text-xs font-semibold text-rose-300">
                  {activeDetail.status === "blocked"
                    ? "High Priority"
                    : "Active Priority"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Difficulty
                </p>
                <p className="mt-1 rounded-lg border border-violet-900/40 bg-violet-900/20 px-3 py-2 text-xs font-semibold text-violet-200">
                  {task.difficultyPoints} points
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Target Date
                </p>
                <p className="mt-1 rounded-lg border border-violet-900/40 bg-violet-900/20 px-3 py-2 text-xs font-semibold text-slate-200">
                  {toReadableDate(activeDetail.softDeadline)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Description
              </p>
              <textarea
                className="mt-2 min-h-32 w-full resize-y rounded-xl border border-violet-900/40 bg-violet-900/15 p-3 text-sm text-slate-200 outline-none ring-violet-400 focus:ring-2"
                defaultValue={activeDetail.description}
              />
            </div>

            <div className="rounded-xl border-l-4 border-violet-400 bg-violet-500/10 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200">
                AI Rationale
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-200">
                {activeDetail.assignmentReasoning}
              </p>
            </div>
          </div>

          <div className="space-y-5 bg-violet-900/10 p-6">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Status
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-violet-900/40 bg-[#171327] px-3 py-2 text-sm font-semibold text-amber-300 outline-none ring-violet-400 focus:ring-2"
                disabled={statusSaving}
                onChange={async (event) => {
                  const nextStatus = event.target.value as TaskStatus;
                  setStatusDraft(nextStatus);
                  setStatusSaving(true);

                  try {
                    const response = await fetch(
                      `/api/projects/${projectId}/tasks/${activeDetail.id}`,
                      {
                        method: "PATCH",
                        headers: {
                          "content-type": "application/json",
                          "x-user-id": userIdHeaderValue,
                        },
                        body: JSON.stringify({ status: nextStatus }),
                      },
                    );

                    if (!response.ok) {
                      throw new Error(
                        `Status update failed (${response.status})`,
                      );
                    }

                    onTaskStatusChange(activeDetail.id, nextStatus);
                    setError(null);
                  } catch (updateError) {
                    setStatusDraft(activeDetail.status);
                    setError(
                      updateError instanceof Error
                        ? updateError.message
                        : "Failed to update task status.",
                    );
                  } finally {
                    setStatusSaving(false);
                  }
                }}
                value={currentStatus ?? "todo"}
              >
                <option value="todo">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Completed</option>
              </select>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Status Timeline
              </p>
              <ul className="mt-2 space-y-3 border-l border-violet-900/40 pl-3">
                {statusTimeline.map((event) => (
                  <li key={event.id} className="relative">
                    <span
                      className={`absolute -left-[18px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-[#1e1926] ${
                        event.tone === "warning"
                          ? "bg-amber-400"
                          : "bg-violet-400"
                      }`}
                    />
                    <p className="text-xs font-semibold text-slate-100">
                      {event.label}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {event.timestamp}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <Link
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-400"
              href={activeDetail.timelineTaskUrl}
            >
              View Workflow Impact
            </Link>

            <button
              className="inline-flex w-full items-center justify-center rounded-xl border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-200 hover:bg-amber-500/20"
              onClick={() => setBackupRequested(true)}
              type="button"
            >
              Request Backup
            </button>

            {backupRequested ? (
              <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200">
                Backup request queued for project admin review.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
