"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useWorkspaceDraft } from "@/lib/workspace/draft-store";
import {
  PlanningWorkspaceState,
  ProjectPlanningStatus,
  ProjectTask,
} from "@/types/dashboard";

type WorkspaceReviewPageProps = {
  initialClarification: PlanningWorkspaceState["clarification"];
  initialDescription: string;
  initialPlanningStatus: ProjectPlanningStatus;
  projectId: string;
  projectName: string;
};

type TaskCategory = "Frontend" | "Backend" | "DevOps" | "QA & Testing";

const CATEGORIES: TaskCategory[] = [
  "Frontend",
  "Backend",
  "DevOps",
  "QA & Testing",
];

function classifyTaskCategory(title: string): TaskCategory {
  const normalized = title.toLowerCase();

  if (
    normalized.includes("qa") ||
    normalized.includes("test") ||
    normalized.includes("cypress")
  ) {
    return "QA & Testing";
  }

  if (
    normalized.includes("deploy") ||
    normalized.includes("docker") ||
    normalized.includes("infra") ||
    normalized.includes("ci") ||
    normalized.includes("pipeline")
  ) {
    return "DevOps";
  }

  if (
    normalized.includes("api") ||
    normalized.includes("db") ||
    normalized.includes("schema") ||
    normalized.includes("auth") ||
    normalized.includes("server")
  ) {
    return "Backend";
  }

  return "Frontend";
}

function difficultyColor(points: ProjectTask["difficultyPoints"]): string {
  if (points <= 2) {
    return "bg-emerald-500";
  }

  if (points <= 3) {
    return "bg-amber-500";
  }

  return "bg-[#622faf]";
}

export function WorkspaceReviewPage({
  initialClarification,
  initialDescription,
  initialPlanningStatus,
  projectId,
  projectName,
}: WorkspaceReviewPageProps) {
  const { draft, isHydrated, updateDraft } = useWorkspaceDraft({
    initialClarification,
    initialDescription,
    initialPlanningStatus,
    projectId,
  });

  const [isEditing, setIsEditing] = useState(false);

  const categorizedTasks = useMemo(() => {
    return CATEGORIES.reduce(
      (accumulator, category) => {
        accumulator[category] = draft.tasks.filter(
          (task) => classifyTaskCategory(task.title) === category,
        );
        return accumulator;
      },
      {
        Frontend: [] as ProjectTask[],
        Backend: [] as ProjectTask[],
        DevOps: [] as ProjectTask[],
        "QA & Testing": [] as ProjectTask[],
      },
    );
  }, [draft.tasks]);

  const addTask = (category: TaskCategory) => {
    const taskCount = draft.tasks.length + 1;
    const prefix = category === "QA & Testing" ? "QA" : category;

    updateDraft((previous) => ({
      ...previous,
      tasks: [
        ...previous.tasks,
        {
          id: `local-task-${Date.now()}-${taskCount}`,
          title: `${prefix} Task ${taskCount}`,
          status: "todo",
          assigneeUserId: null,
          difficultyPoints: 2,
        },
      ],
    }));
  };

  const updateTask = (taskId: string, patch: Partial<ProjectTask>) => {
    updateDraft((previous) => ({
      ...previous,
      tasks: previous.tasks.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task,
      ),
    }));
  };

  const deleteTask = (taskId: string) => {
    updateDraft((previous) => ({
      ...previous,
      tasks: previous.tasks.filter((task) => task.id !== taskId),
      dependencyEdges: previous.dependencyEdges.filter(
        (edge) => edge.taskId !== taskId && edge.dependsOnTaskId !== taskId,
      ),
    }));
  };

  const exportDraft = () => {
    const payload = {
      tasks: draft.tasks,
      dependencyEdges: draft.dependencyEdges,
      planningStatus: draft.planningStatus,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `project-${projectId}-draft.json`;
    anchor.click();

    URL.revokeObjectURL(url);
  };

  if (!isHydrated) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-7xl animate-pulse rounded-2xl border border-white/10 bg-white/5 p-8">
          Loading review board...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] bg-[radial-gradient(circle,#ffffff10_1px,transparent_1px)] [background-size:24px_24px] px-4 py-8 pb-36 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <nav className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Projects</span>
              <span>›</span>
              <span>{projectName}</span>
            </nav>
            <h1 className="text-5xl font-bold tracking-tight">
              Task Inventory Blueprint
            </h1>
            <p className="mt-2 max-w-2xl text-slate-400">
              Review and refine the architectural breakdown before initiating
              delegation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isEditing ? (
              <button
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-400 transition hover:text-white"
                onClick={() => setIsEditing(false)}
                type="button"
              >
                Exit Edit Mode
              </button>
            ) : null}
            <button
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold transition hover:border-[#622faf]"
              onClick={() => setIsEditing((previous) => !previous)}
              type="button"
            >
              {isEditing ? "Review Specs" : "Edit Specs"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((category) => {
            const tasks = categorizedTasks[category];

            return (
              <section
                className="rounded-xl border border-[#622faf]/25 bg-[#18131f]/70 p-5 backdrop-blur-xl"
                key={category}
              >
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold">{category}</h2>
                  <span className="rounded bg-[#622faf]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b5cf6]">
                    {tasks.length} tasks
                  </span>
                </div>

                <div className="space-y-3">
                  {tasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-700 p-4 text-center text-xs uppercase tracking-[0.16em] text-slate-500">
                      No tasks
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <div
                        className="rounded-lg border border-white/10 bg-white/5 p-3"
                        key={task.id}
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <button
                                className="text-xs text-slate-500 transition hover:text-rose-300"
                                onClick={() => deleteTask(task.id)}
                                type="button"
                              >
                                Delete
                              </button>
                              <input
                                className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none transition focus:border-[#622faf]"
                                onChange={(event) =>
                                  updateTask(task.id, {
                                    title: event.target.value,
                                  })
                                }
                                value={task.title}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs outline-none transition focus:border-[#622faf]"
                                onChange={(event) =>
                                  updateTask(task.id, {
                                    status: event.target
                                      .value as ProjectTask["status"],
                                  })
                                }
                                value={task.status}
                              >
                                <option value="todo">todo</option>
                                <option value="in_progress">in_progress</option>
                                <option value="blocked">blocked</option>
                                <option value="done">done</option>
                              </select>
                              <select
                                className="rounded border border-white/10 bg-black/30 px-2 py-1.5 text-xs outline-none transition focus:border-[#622faf]"
                                onChange={(event) =>
                                  updateTask(task.id, {
                                    difficultyPoints: Number(
                                      event.target.value,
                                    ) as ProjectTask["difficultyPoints"],
                                  })
                                }
                                value={task.difficultyPoints}
                              >
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                                <option value={5}>5</option>
                                <option value={8}>8</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium leading-tight text-slate-100">
                              {task.title}
                            </p>
                            <span
                              className={`mt-1 size-2 rounded-full ${difficultyColor(task.difficultyPoints)}`}
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {isEditing ? (
                  <button
                    className="mt-4 w-full rounded-lg border border-dashed border-slate-700 py-2.5 text-sm font-medium text-slate-400 transition hover:border-[#622faf]/60 hover:text-[#8b5cf6]"
                    onClick={() => addTask(category)}
                    type="button"
                  >
                    + Add New Task
                  </button>
                ) : null}
              </section>
            );
          })}

          <section className="rounded-xl border border-[#622faf]/25 bg-gradient-to-br from-[#622faf]/15 to-transparent p-5 md:col-span-2">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#8b5cf6]">
              Blueprinting Guidelines
            </h3>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-3 text-sm text-slate-300">
                <p>
                  You are in <strong className="text-white">Draft Mode</strong>.
                  Changes remain editable until lock.
                </p>
                <p>Dependencies captured: {draft.dependencyEdges.length}</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/25 p-4 text-xs text-slate-400">
                <p className="mb-2 font-bold text-slate-200">AI Suggestion</p>
                <p>
                  Keep high-difficulty tasks balanced and avoid locking until
                  dependencies are reviewed.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-[#622faf]/25 bg-[#18131f]/70 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Dependency Preview</h3>
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
              {draft.dependencyEdges.length} links
            </span>
          </div>

          {draft.dependencyEdges.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 bg-black/20 p-4 text-sm text-slate-400">
              No dependencies defined yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {draft.dependencyEdges.map((edge) => (
                <li
                  key={`${edge.taskId}-${edge.dependsOnTaskId}`}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300"
                >
                  {edge.dependsOnTaskId} → {edge.taskId}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-50 p-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 rounded-2xl border border-[#622faf]/30 bg-[#18131f]/90 p-4 shadow-2xl shadow-[#622faf]/20 backdrop-blur-xl">
          <div className="hidden md:flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {isEditing ? "Edit Session Active" : "Inventory Status"}
            </span>
            <span className="text-sm text-slate-200">
              {isEditing
                ? "Unsaved edits in blueprint"
                : `${draft.tasks.length} tasks prepared for lock`}
            </span>
          </div>

          <div className="flex w-full items-center gap-3 md:w-auto">
            <button
              className="flex-1 rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold transition hover:bg-slate-800 md:flex-none"
              onClick={exportDraft}
              type="button"
            >
              Export Draft
            </button>
            {isEditing ? (
              <button
                className="flex-1 rounded-xl bg-[#622faf] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#622faf]/30 transition hover:bg-[#7444bd] md:flex-none"
                onClick={() => setIsEditing(false)}
                type="button"
              >
                Save Changes
              </button>
            ) : (
              <Link
                className={`flex-1 rounded-xl px-8 py-3 text-center text-sm font-bold text-white shadow-lg shadow-[#622faf]/30 transition md:flex-none ${
                  draft.tasks.length === 0
                    ? "pointer-events-none bg-slate-600"
                    : "bg-[#622faf] hover:bg-[#7444bd]"
                }`}
                href={`/projects/${projectId}/workspace/lock`}
              >
                Continue to Lock
              </Link>
            )}
          </div>
        </div>
      </footer>
    </main>
  );
}
