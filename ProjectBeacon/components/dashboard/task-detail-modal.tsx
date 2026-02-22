"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MyTaskDTO, TaskDetailModalDTO } from "@/types/dashboard";

type TaskDetailModalProps = {
  projectId: string;
  task: MyTaskDTO | null;
  onClose: () => void;
};

function toReadableDate(value: string | null): string {
  if (!value) {
    return "No soft deadline set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
      "Assignment reasoning endpoint is not available yet. This placeholder confirms modal plumbing and timeline deep-link behavior.",
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

export function TaskDetailModal({
  projectId,
  task,
  onClose,
}: TaskDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetailModalDTO | null>(null);

  const fallback = useMemo(
    () => (task ? createFallbackDetail(projectId, task) : null),
    [projectId, task],
  );

  useEffect(() => {
    if (!task) {
      setDetail(null);
      setError(null);
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
              "Task detail payload is incomplete. Showing scaffold detail.",
            );
          }
        }
      } catch (fetchError) {
        if (!cancelled) {
          setDetail(fallback);
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
  }, [fallback, projectId, task]);

  if (!task) {
    return null;
  }

  const activeDetail = detail ?? fallback;
  if (!activeDetail) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/45 p-4">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Task Detail
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {activeDetail.title}
            </h2>
          </div>
          <button
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {loading ? (
          <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            Loading task detail...
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </p>
        ) : null}

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {activeDetail.status}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Soft Deadline
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {toReadableDate(activeDetail.softDeadline)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Timeline Placement
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {activeDetail.timelinePlacement.phase} (
              {activeDetail.timelinePlacement.sequenceIndex}/
              {activeDetail.timelinePlacement.totalTasks})
            </dd>
          </div>
        </dl>

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Description
          </h3>
          <p className="mt-1 text-sm text-slate-800">
            {activeDetail.description}
          </p>
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Assignment Reasoning
          </h3>
          <p className="mt-1 text-sm text-slate-800">
            {activeDetail.assignmentReasoning}
          </p>
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dependency Summary
          </h3>
          {activeDetail.dependencyTaskIds.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">No dependencies</p>
          ) : (
            <ul className="mt-1 list-disc pl-5 text-sm text-slate-800">
              {activeDetail.dependencyTaskIds.map((dependencyTaskId) => (
                <li key={dependencyTaskId}>{dependencyTaskId}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <Link
            className="inline-flex rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            href={activeDetail.timelineTaskUrl}
          >
            Open in Timeline
          </Link>
        </div>
      </section>
    </div>
  );
}
