"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  WorkflowBoardColumnDTO,
  WorkflowBoardDTO,
  WorkflowBoardTaskDTO,
} from "@/types/workflow";

type BoardPageProps = {
  projectId: string;
  role: "admin" | "user";
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
        title: "Draft timeline checkpoints",
        status: "in_progress",
        softDeadline: new Date(
          Date.now() + 2 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        difficultyPoints: 3,
        phase: "beginning",
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
        id: "t_board_2",
        title: "Integrate dashboard API responses",
        status: "todo",
        softDeadline: new Date(
          Date.now() + 4 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        difficultyPoints: 2,
        phase: "middle",
      },
    ],
  },
];

const FALLBACK_UNASSIGNED: WorkflowBoardTaskDTO[] = [
  {
    id: "t_board_3",
    title: "QA workflow fallback states",
    status: "blocked",
    softDeadline: null,
    difficultyPoints: 1,
    phase: "end",
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

  const capability = payload.capability;

  return {
    capability: {
      role: capability.role === "admin" ? "admin" : "user",
      canManageProject: Boolean(capability.canManageProject),
      canEditWorkflow: Boolean(capability.canEditWorkflow),
    },
    columns: payload.columns,
    unassigned: payload.unassigned,
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

function renderTaskCard(task: WorkflowBoardTaskDTO) {
  return (
    <article key={task.id} className="rounded-lg border border-slate-200 p-3">
      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
      <p className="mt-1 text-xs text-slate-500">
        {task.status} · phase {task.phase} · {task.difficultyPoints} pts
      </p>
      <p className="mt-1 text-xs text-slate-500">
        due {toDueLabel(task.softDeadline)}
      </p>
    </article>
  );
}

export function BoardPage({ projectId, role }: BoardPageProps) {
  const [columns, setColumns] = useState<WorkflowBoardColumnDTO[]>([]);
  const [unassigned, setUnassigned] = useState<WorkflowBoardTaskDTO[]>([]);
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
          setUnassigned(payload.unassigned);
          setCapability(payload.capability);
        }
      } catch (boardError) {
        if (!cancelled) {
          setColumns(FALLBACK_COLUMNS);
          setUnassigned(FALLBACK_UNASSIGNED);
          setCapability({
            role,
            canManageProject: role === "admin",
            canEditWorkflow: role === "admin",
          });
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
                {column.name}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {column.role} · {column.email || "No email"}
              </p>
              <div className="mt-3 space-y-3">
                {column.tasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                    No tasks assigned.
                  </p>
                ) : (
                  column.tasks.map((task) => renderTaskCard(task))
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Unassigned</h2>
          {unassigned.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No unassigned tasks.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {unassigned.map((task) => renderTaskCard(task))}
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}
