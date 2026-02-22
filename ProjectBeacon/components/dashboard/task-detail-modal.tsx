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

type PriorityLevel = "low" | "medium" | "high";

type TaskDraftPayload = Pick<
  MyTaskDTO,
  "title" | "description" | "status" | "difficultyPoints" | "softDeadline"
>;

type TaskDetailModalProps = {
  projectId: string;
  userIdHeaderValue: string;
  onClose: () => void;
  mode?: "edit" | "create";
  task?:
    | (MyTaskDTO & {
        createdAt?: string | null;
        assigneeUserId?: string | null;
      })
    | null;
  createAssigneeLabel?: string;
  onTaskUpdate?: (taskId: string, patch: Partial<TaskDraftPayload>) => void;
  onTaskCreate?: (draft: TaskDraftPayload) => Promise<void>;
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

function toDateInputValue(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function toIsoFromDateInput(value: string): string | null {
  if (!value) {
    return null;
  }

  return `${value}T00:00:00.000Z`;
}

function priorityFromDifficulty(
  difficulty: MyTaskDTO["difficultyPoints"],
): PriorityLevel {
  if (difficulty <= 2) {
    return "low";
  }

  if (difficulty === 3) {
    return "medium";
  }

  return "high";
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
    assignmentReasoning: "",
    dependencyTaskIds: [],
    timelineTaskUrl: `/projects/${projectId}/timeline?taskId=${task.id}`,
    timelinePlacement: {
      phase: "middle",
      sequenceIndex: 1,
      totalTasks: 1,
    },
  };
}

function createDraftDetail(projectId: string): TaskDetailModalDTO {
  return {
    id: "draft-task",
    title: "",
    description: "",
    status: "todo",
    softDeadline: null,
    assignmentReasoning: "",
    dependencyTaskIds: [],
    timelineTaskUrl: `/projects/${projectId}/board`,
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
    typeof detail.assignmentReasoning === "string" &&
    (detail.status === "todo" ||
      detail.status === "in_progress" ||
      detail.status === "blocked" ||
      detail.status === "done") &&
    (typeof detail.softDeadline === "string" || detail.softDeadline === null) &&
    Array.isArray(detail.dependencyTaskIds) &&
    typeof detail.timelineTaskUrl === "string" &&
    !!detail.timelinePlacement &&
    typeof detail.timelinePlacement === "object"
  );
}

function timelineEventsForDetail(
  status: TaskStatus,
  createdAt: string | null,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (status === "in_progress") {
    events.push({
      id: "status-in-progress",
      label: "Moved to In Progress",
      timestamp: "Current",
      tone: "warning",
    });
  } else if (status === "blocked") {
    events.push({
      id: "status-blocked",
      label: "Marked as Blocked",
      timestamp: "Current",
      tone: "warning",
    });
  } else if (status === "done") {
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
  userIdHeaderValue,
  onClose,
  mode = "edit",
  task = null,
  createAssigneeLabel,
  onTaskUpdate,
  onTaskCreate,
}: TaskDetailModalProps) {
  const isCreateMode = mode === "create";
  const normalizedViewerUserId = userIdHeaderValue.trim().toLowerCase();
  const normalizedAssigneeUserId = task?.assigneeUserId?.trim().toLowerCase();
  const isTaskOwner =
    !isCreateMode &&
    Boolean(normalizedAssigneeUserId) &&
    normalizedAssigneeUserId === normalizedViewerUserId;
  const isReadOnly = !isCreateMode && !isTaskOwner;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetailModalDTO | null>(null);

  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<TaskStatus>("todo");
  const [priorityDraft, setPriorityDraft] = useState<PriorityLevel>("medium");
  const [difficultyDraft, setDifficultyDraft] =
    useState<MyTaskDTO["difficultyPoints"]>(3);
  const [softDeadlineDraft, setSoftDeadlineDraft] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const draftDetail = useMemo(() => createDraftDetail(projectId), [projectId]);

  const fallback = useMemo(() => {
    if (isCreateMode) {
      return draftDetail;
    }

    return task ? createFallbackDetail(projectId, task) : null;
  }, [draftDetail, isCreateMode, projectId, task]);

  const activeDetail = detail ?? fallback;

  useEffect(() => {
    if (isCreateMode) {
      setDetail(draftDetail);
      setLoading(false);
      setError(null);
      setSaveMessage(null);
      return;
    }

    if (!task) {
      setDetail(null);
      setError(null);
      setSaveMessage(null);
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
          } else {
            setDetail(fallback);
            setError(
              "Task detail payload is incomplete. Showing fallback detail.",
            );
          }
        }
      } catch (fetchError) {
        if (!cancelled) {
          setDetail(fallback);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load task detail. Showing fallback detail.",
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
  }, [draftDetail, fallback, isCreateMode, projectId, task, userIdHeaderValue]);

  useEffect(() => {
    if (!activeDetail) {
      return;
    }

    setTitleDraft(activeDetail.title);
    setDescriptionDraft(activeDetail.description);
    setStatusDraft(activeDetail.status);
    setDifficultyDraft(isCreateMode ? 3 : (task?.difficultyPoints ?? 3));
    setPriorityDraft(
      priorityFromDifficulty(isCreateMode ? 3 : (task?.difficultyPoints ?? 3)),
    );
    setSoftDeadlineDraft(toDateInputValue(activeDetail.softDeadline));
    setSaveMessage(null);
  }, [activeDetail, isCreateMode, task]);

  useEffect(() => {
    if (!isCreateMode && !task) {
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
  }, [isCreateMode, onClose, task]);

  if ((!isCreateMode && !task) || !activeDetail) {
    return null;
  }

  const baseDateInput = toDateInputValue(activeDetail.softDeadline);
  const hasChanges = isReadOnly
    ? false
    : isCreateMode
      ? titleDraft.trim().length > 0 ||
        descriptionDraft.length > 0 ||
        statusDraft !== "todo" ||
        difficultyDraft !== 3 ||
        softDeadlineDraft.length > 0
      : titleDraft.trim() !== activeDetail.title ||
        descriptionDraft !== activeDetail.description ||
        statusDraft !== activeDetail.status ||
        difficultyDraft !== (task?.difficultyPoints ?? 3) ||
        softDeadlineDraft !== baseDateInput;

  const statusTimeline = timelineEventsForDetail(
    statusDraft,
    isCreateMode ? null : (task?.createdAt ?? null),
  );

  async function handleSave(): Promise<void> {
    if (isSaving) {
      return;
    }
    if (isReadOnly) {
      return;
    }

    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setError("Task title is required.");
      return;
    }

    const draft: TaskDraftPayload = {
      title: nextTitle,
      description: descriptionDraft,
      status: statusDraft,
      difficultyPoints: difficultyDraft,
      softDeadline: toIsoFromDateInput(softDeadlineDraft),
    };

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      if (isCreateMode) {
        if (!onTaskCreate) {
          throw new Error("Create handler is not configured.");
        }

        await onTaskCreate(draft);
        setSaveMessage("Task created.");
        onClose();
        return;
      }

      const activeTaskId = activeDetail.id;
      const response = await fetch(
        `/api/projects/${projectId}/tasks/${activeTaskId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-user-id": userIdHeaderValue,
          },
          body: JSON.stringify({
            title: draft.title,
            description: draft.description,
            status: draft.status,
            difficultyPoints: draft.difficultyPoints,
            softDeadline: draft.softDeadline,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Save failed (${response.status})`);
      }

      setDetail((current) =>
        current
          ? {
              ...current,
              title: draft.title,
              description: draft.description,
              status: draft.status,
              softDeadline: draft.softDeadline,
            }
          : current,
      );

      onTaskUpdate?.(activeTaskId, draft);
      setSaveMessage("Task saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save task.",
      );
    } finally {
      setIsSaving(false);
    }
  }

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
          <h2 className="text-xl font-semibold">
            {isCreateMode ? "Create Task" : "Task Details"}
          </h2>
          <button
            className="rounded-md border border-violet-700/60 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-violet-900/30"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="grid max-h-[calc(90vh-140px)] gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-5 border-b border-violet-900/40 p-6 lg:border-b-0 lg:border-r">
            <input
              className="w-full rounded-lg border border-violet-900/40 bg-violet-900/15 px-3 py-2 text-2xl font-semibold text-white outline-none ring-violet-400 focus:ring-2"
              disabled={isReadOnly || isSaving}
              maxLength={200}
              onChange={(event) => setTitleDraft(event.target.value)}
              placeholder="Task title"
              value={titleDraft}
            />

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

            {saveMessage ? (
              <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                {saveMessage}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Priority
                </p>
                <select
                  className="mt-1 w-full rounded-lg border border-violet-900/40 bg-violet-900/20 px-3 py-2 text-xs font-semibold text-slate-100 outline-none ring-violet-400 focus:ring-2"
                  disabled={isReadOnly || isSaving}
                  onChange={(event) =>
                    setPriorityDraft(event.target.value as PriorityLevel)
                  }
                  value={priorityDraft}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Difficulty
                </p>
                <select
                  className="mt-1 w-full rounded-lg border border-violet-900/40 bg-violet-900/20 px-3 py-2 text-xs font-semibold text-violet-200 outline-none ring-violet-400 focus:ring-2"
                  disabled={isReadOnly || isSaving}
                  onChange={(event) =>
                    setDifficultyDraft(
                      Number(
                        event.target.value,
                      ) as MyTaskDTO["difficultyPoints"],
                    )
                  }
                  value={difficultyDraft}
                >
                  <option value={1}>1 - Very Low</option>
                  <option value={2}>2 - Low</option>
                  <option value={3}>3 - Medium</option>
                  <option value={5}>5 - High</option>
                  <option value={8}>8 - Very High</option>
                </select>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Target Date
                </p>
                <input
                  className="mt-1 w-full rounded-lg border border-violet-900/40 bg-violet-900/20 px-3 py-2 text-xs font-semibold text-slate-200 outline-none ring-violet-400 focus:ring-2"
                  disabled={isReadOnly || isSaving}
                  onChange={(event) => setSoftDeadlineDraft(event.target.value)}
                  type="date"
                  value={softDeadlineDraft}
                />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Description
              </p>
              <textarea
                className="mt-2 min-h-40 w-full resize-y rounded-xl border border-violet-900/40 bg-violet-900/15 p-3 text-sm text-slate-200 outline-none ring-violet-400 focus:ring-2"
                disabled={isReadOnly || isSaving}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                value={descriptionDraft}
              />
            </div>

            {!isCreateMode &&
            activeDetail.assignmentReasoning.trim().length > 0 ? (
              <div className="rounded-xl border-l-4 border-violet-400 bg-violet-500/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200">
                  AI Rationale
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-200">
                  {activeDetail.assignmentReasoning}
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-5 bg-violet-900/10 p-6">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Status
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-violet-900/40 bg-[#171327] px-3 py-2 text-sm font-semibold text-amber-300 outline-none ring-violet-400 focus:ring-2"
                disabled={isReadOnly || isSaving}
                onChange={(event) =>
                  setStatusDraft(event.target.value as TaskStatus)
                }
                value={statusDraft}
              >
                <option value="todo">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Completed</option>
              </select>
            </div>

            {isCreateMode && createAssigneeLabel ? (
              <div className="rounded-lg border border-violet-900/40 bg-[#171327] px-3 py-2 text-xs text-slate-300">
                Assignee: {createAssigneeLabel}
              </div>
            ) : null}

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

            <div className="rounded-lg border border-violet-900/40 bg-[#171327] px-3 py-2 text-xs text-slate-300">
              Due: {toReadableDate(toIsoFromDateInput(softDeadlineDraft))}
            </div>

            {!isCreateMode ? (
              <Link
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-400"
                href={activeDetail.timelineTaskUrl}
              >
                View Workflow Impact
              </Link>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end border-t border-violet-900/40 p-4">
          {isReadOnly ? (
            <span className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300">
              View only
            </span>
          ) : (
            <button
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/35 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              disabled={!hasChanges || isSaving}
              onClick={() => {
                void handleSave();
              }}
              type="button"
            >
              {isSaving
                ? isCreateMode
                  ? "Creating..."
                  : "Saving..."
                : isCreateMode
                  ? "Create Task"
                  : "Save"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
