"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  WorkflowBoardColumnDTO,
  WorkflowBoardDTO,
} from "@/types/workflow";

type BoardPageProps = {
  projectId: string;
  role: "admin" | "user";
};

const FALLBACK_COLUMNS: WorkflowBoardColumnDTO[] = [
  {
    userId: "user_001",
    userName: "Alex",
    tasks: [
      {
        id: "t_board_1",
        title: "Draft timeline checkpoints",
        status: "in_progress",
        dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        dependencyTaskIds: [],
        phase: "beginning",
      },
    ],
  },
  {
    userId: "user_002",
    userName: "Jordan",
    tasks: [
      {
        id: "t_board_2",
        title: "Integrate dashboard API responses",
        status: "todo",
        dueAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        dependencyTaskIds: ["t_board_1"],
        phase: "middle",
      },
    ],
  },
];

function parseBoardPayload(value: unknown): WorkflowBoardDTO | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as {
    columns?: WorkflowBoardColumnDTO[];
    capabilities?: { canEdit?: boolean; canReassign?: boolean };
  };

  if (!Array.isArray(payload.columns)) {
    return null;
  }

  return {
    columns: payload.columns,
    capabilities: {
      canEdit: Boolean(payload.capabilities?.canEdit),
      canReassign: payload.capabilities?.canReassign,
    },
  };
}

function toDueLabel(value: string | null): string {
  if (!value) {
    return "No due date";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }
  return date.toLocaleString();
}

export function BoardPage({ projectId, role }: BoardPageProps) {
  const [columns, setColumns] = useState<WorkflowBoardColumnDTO[]>([]);
  const [canEdit, setCanEdit] = useState(role === "admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadBoard() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/projects/${projectId}/workflow/board`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(`Board endpoint returned ${response.status}`);
        }

        const payload = parseBoardPayload((await response.json()) as unknown);
        if (!payload) {
          throw new Error("Board payload missing required fields.");
        }

        if (!cancelled) {
          setColumns(payload.columns);
          setCanEdit(Boolean(payload.capabilities.canEdit));
        }
      } catch (boardError) {
        if (!cancelled) {
          setColumns(FALLBACK_COLUMNS);
          setCanEdit(role === "admin");
          setError(
            boardError instanceof Error
              ? `${boardError.message}. Showing scaffold board.`
              : "Failed to load board. Showing scaffold board.",
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

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Workflow Board
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              One column per project member, grouped by assignment owner.
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-300 p-1">
            <Link
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white"
              href={`/projects/${projectId}/board`}
            >
              Board
            </Link>
            <Link
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              href={`/projects/${projectId}/timeline`}
            >
              Timeline
            </Link>
          </div>
        </div>
        <p className="mt-3 text-xs font-medium text-slate-500">
          Edit affordances:{" "}
          {canEdit
            ? "enabled by API capability flags"
            : "read-only by API capability flags"}
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Loading board...
        </p>
      ) : columns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
          No workflow columns available yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {columns.map((column) => (
            <section
              key={column.userId}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 className="text-base font-semibold text-slate-900">
                {column.userName}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {column.tasks.length} tasks
              </p>
              <div className="mt-3 space-y-3">
                {column.tasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                    No tasks assigned.
                  </p>
                ) : (
                  column.tasks.map((task) => (
                    <article
                      key={task.id}
                      className="rounded-lg border border-slate-200 p-3"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {task.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {task.status} · due {toDueLabel(task.dueAt)}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
