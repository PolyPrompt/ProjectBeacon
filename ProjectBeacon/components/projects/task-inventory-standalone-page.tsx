"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  INVENTORY_CATEGORY_ORDER,
  inferInventoryCategories,
  type InventoryCategory,
} from "@/lib/tasks/inventory-categories";
import type { WorkflowBoardDTO, WorkflowBoardTaskDTO } from "@/types/workflow";

type InventoryMode = "review" | "edit";
type InventoryPriority = "low" | "medium" | "high";

type InventoryTask = {
  categories: InventoryCategory[];
  id: string;
  priority: InventoryPriority;
  title: string;
};

type TaskInventoryStandalonePageProps = {
  projectId: string;
};

const CATEGORY_META: Record<
  InventoryCategory,
  { icon: string; title: InventoryCategory }
> = {
  "Research & Discovery": { icon: "R", title: "Research & Discovery" },
  "Planning & Coordination": { icon: "P", title: "Planning & Coordination" },
  "Implementation & Production": {
    icon: "I",
    title: "Implementation & Production",
  },
  "Analysis & Validation": { icon: "A", title: "Analysis & Validation" },
  "Writing & Documentation": { icon: "W", title: "Writing & Documentation" },
  "Presentation & Submission": {
    icon: "S",
    title: "Presentation & Submission",
  },
};

const PRIORITY_DOT: Record<InventoryPriority, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-violet-500",
};

const FALLBACK_TASKS: InventoryTask[] = [
  {
    categories: ["Research & Discovery", "Planning & Coordination"],
    id: "fallback-research-1",
    priority: "low",
    title: "Review rubric and define project success criteria",
  },
  {
    categories: ["Research & Discovery", "Writing & Documentation"],
    id: "fallback-research-2",
    priority: "medium",
    title: "Gather sources or reference materials",
  },
  {
    categories: ["Planning & Coordination", "Implementation & Production"],
    id: "fallback-build-1",
    priority: "high",
    title: "Create first complete draft or prototype",
  },
  {
    categories: ["Analysis & Validation", "Implementation & Production"],
    id: "fallback-analysis-1",
    priority: "medium",
    title: "Run validation pass and capture findings",
  },
  {
    categories: ["Writing & Documentation", "Analysis & Validation"],
    id: "fallback-writing-1",
    priority: "medium",
    title: "Finalize written report with revisions",
  },
  {
    categories: ["Presentation & Submission", "Planning & Coordination"],
    id: "fallback-delivery-1",
    priority: "medium",
    title: "Assemble presentation and submission package",
  },
];

function createDraftId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mapDifficultyToPriority(
  points: WorkflowBoardTaskDTO["difficultyPoints"],
): InventoryPriority {
  if (points <= 2) {
    return "low";
  }

  if (points === 3) {
    return "medium";
  }

  return "high";
}

function parseBoardPayload(payload: unknown): WorkflowBoardDTO | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Partial<WorkflowBoardDTO>;
  if (
    !Array.isArray(candidate.columns) ||
    !Array.isArray(candidate.unassigned)
  ) {
    return null;
  }

  return {
    capability: {
      role: candidate.capability?.role === "admin" ? "admin" : "user",
      canManageProject: Boolean(candidate.capability?.canManageProject),
      canEditWorkflow: Boolean(candidate.capability?.canEditWorkflow),
    },
    columns: candidate.columns,
    unassigned: candidate.unassigned,
  };
}

function toInventoryTasks(board: WorkflowBoardDTO): InventoryTask[] {
  const assigned = board.columns.flatMap((column) =>
    column.tasks.map((task) => ({
      categories: inferInventoryCategories(task),
      id: task.id,
      priority: mapDifficultyToPriority(task.difficultyPoints),
      title: task.title,
    })),
  );

  const unassigned = board.unassigned.map((task) => ({
    categories: inferInventoryCategories(task),
    id: task.id,
    priority: mapDifficultyToPriority(task.difficultyPoints),
    title: task.title,
  }));

  return [...assigned, ...unassigned];
}

function cyclePriority(priority: InventoryPriority): InventoryPriority {
  if (priority === "low") {
    return "medium";
  }
  if (priority === "medium") {
    return "high";
  }
  return "low";
}

function exportTasks(tasks: InventoryTask[], projectId: string): void {
  const content = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      projectId,
      tasks,
    },
    null,
    2,
  );

  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${projectId}-inventory-draft.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function loadInitialTasks(projectId: string): Promise<InventoryTask[]> {
  try {
    const response = await fetch(`/api/projects/${projectId}/workflow/board`, {
      cache: "no-store",
    });

    const payload = parseBoardPayload((await response.json()) as unknown);
    if (!response.ok || !payload) {
      return FALLBACK_TASKS;
    }

    const mapped = toInventoryTasks(payload);
    return mapped.length > 0 ? mapped : FALLBACK_TASKS;
  } catch {
    return FALLBACK_TASKS;
  }
}

export default function TaskInventoryStandalonePage({
  projectId,
}: TaskInventoryStandalonePageProps) {
  const router = useRouter();
  const [mode, setMode] = useState<InventoryMode>("review");
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [committedTasks, setCommittedTasks] = useState<InventoryTask[]>([]);
  const [draftTasks, setDraftTasks] = useState<InventoryTask[]>([]);

  useEffect(() => {
    void loadInitialTasks(projectId).then((tasks) => {
      setCommittedTasks(tasks);
      setDraftTasks(
        tasks.map((task) => ({ ...task, categories: [...task.categories] })),
      );
      setIsLoading(false);
    });
  }, [projectId]);

  const activeTasks = mode === "edit" ? draftTasks : committedTasks;
  const groupedTasks = useMemo(
    () =>
      INVENTORY_CATEGORY_ORDER.map((category) => ({
        category,
        tasks: activeTasks.filter((task) => task.categories.includes(category)),
      })),
    [activeTasks],
  );

  function switchToEditMode() {
    setDraftTasks(
      committedTasks.map((task) => ({
        ...task,
        categories: [...task.categories],
      })),
    );
    setMode("edit");
    setStatusMessage(null);
  }

  function exitEditMode() {
    setDraftTasks(
      committedTasks.map((task) => ({
        ...task,
        categories: [...task.categories],
      })),
    );
    setMode("review");
    setStatusMessage("Unsaved edits were discarded.");
  }

  function addTask(category: InventoryCategory) {
    const nextTask: InventoryTask = {
      categories: [category],
      id: createDraftId(),
      priority: "medium",
      title: "",
    };

    if (mode === "review") {
      setDraftTasks([
        ...committedTasks.map((task) => ({
          ...task,
          categories: [...task.categories],
        })),
        nextTask,
      ]);
      setMode("edit");
      return;
    }

    setDraftTasks((current) => [...current, nextTask]);
  }

  function removeDraftTask(taskId: string) {
    setDraftTasks((current) => current.filter((task) => task.id !== taskId));
  }

  function clearAllDraftTasks() {
    if (draftTasks.length === 0) {
      return;
    }

    const confirmed =
      typeof window === "undefined" ||
      window.confirm(
        "Clear all draft tasks? This only affects the current edit session until saved.",
      );

    if (!confirmed) {
      return;
    }

    setDraftTasks([]);
    setStatusMessage("Cleared all draft tasks in this edit session.");
  }

  function updateDraftTitle(taskId: string, title: string) {
    setDraftTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, title } : task)),
    );
  }

  function updateDraftPriority(taskId: string) {
    setDraftTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, priority: cyclePriority(task.priority) }
          : task,
      ),
    );
  }

  function toggleDraftCategory(taskId: string, category: InventoryCategory) {
    setDraftTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        const nextCategories = task.categories.includes(category)
          ? task.categories.filter((value) => value !== category)
          : [...task.categories, category];

        return {
          ...task,
          categories: nextCategories,
        };
      }),
    );
  }

  function saveChanges() {
    const normalized = draftTasks.map((task) => ({
      ...task,
      categories:
        task.categories.length > 0
          ? [...new Set<InventoryCategory>(task.categories)]
          : (["Planning & Coordination"] as InventoryCategory[]),
      title:
        task.title.trim().length > 0
          ? task.title.trim()
          : "Untitled inventory task",
    }));

    setCommittedTasks(normalized);
    setDraftTasks(
      normalized.map((task) => ({ ...task, categories: [...task.categories] })),
    );
    setMode("review");
    setStatusMessage("Blueprint edits saved locally.");
  }

  if (isLoading) {
    return (
      <div className="dark min-h-screen bg-[#f7f6f8] text-slate-900 dark:bg-[#0a0a0a] dark:text-slate-100 [background-image:radial-gradient(circle,_#ffffff10_1px,_transparent_1px)] [background-size:24px_24px]">
        <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-32">
          <div className="rounded-xl border border-[rgba(98,47,175,0.2)] bg-[rgba(24,19,31,0.7)] p-5 text-slate-300 backdrop-blur-[12px]">
            Loading task inventory blueprint...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-[#f7f6f8] font-[Manrope,sans-serif] text-slate-900 dark:bg-[#0a0a0a] dark:text-slate-100 [background-image:radial-gradient(circle,_#ffffff10_1px,_transparent_1px)] [background-size:24px_24px]">
      <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-32">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <nav className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Projects</span>
              <span className="text-xs">›</span>
              <span>Nexus OS Redesign</span>
            </nav>
            <h2 className="text-4xl font-bold tracking-tight text-slate-100">
              Task Inventory Blueprint
            </h2>
            <p className="mt-2 max-w-2xl text-slate-400">
              Review and refine the architectural breakdown before initiating AI
              delegation. Tasks are currently in a non-committed state.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {mode === "edit" ? (
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-slate-400 transition-all hover:text-white"
                onClick={exitEditMode}
              >
                <span className="text-base leading-none">×</span>
                Exit Edit Mode
              </button>
            ) : null}
            {mode === "edit" ? (
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-200 transition-all hover:border-red-400 hover:text-red-100 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                onClick={clearAllDraftTasks}
                disabled={draftTasks.length === 0}
              >
                Clear All Tasks
              </button>
            ) : null}
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold transition-all hover:border-[#622faf]"
              onClick={switchToEditMode}
              disabled={mode === "edit"}
            >
              <span className="text-xs leading-none">✎</span>
              Edit Specs
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groupedTasks.map(({ category, tasks }) => (
            <section
              key={category}
              className="flex h-fit flex-col rounded-xl border border-[rgba(98,47,175,0.2)] bg-[rgba(24,19,31,0.7)] p-5 backdrop-blur-[12px]"
            >
              <div className="mb-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[#622faf]">
                    {CATEGORY_META[category].icon}
                  </span>
                  <h3 className="text-lg font-bold text-slate-100">
                    {CATEGORY_META[category].title}
                  </h3>
                </div>
                <span className="rounded bg-[#622faf]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#622faf]">
                  {tasks.length} Task{tasks.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mb-6 space-y-3">
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 p-4 opacity-40">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      No Tasks Yet
                    </span>
                  </div>
                ) : null}

                {tasks.map((task) =>
                  mode === "review" ? (
                    <article
                      key={`${category}-${task.id}`}
                      className="group cursor-pointer rounded-lg border border-white/5 bg-white/5 p-3 transition-all hover:border-[#622faf]/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-sm font-medium leading-tight text-slate-100">
                            {task.title}
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {task.categories.map((taskCategory) => (
                              <span
                                key={`${task.id}-${taskCategory}`}
                                className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-300"
                              >
                                {taskCategory}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span
                          className={`mt-1 h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority]}`}
                        />
                      </div>
                    </article>
                  ) : (
                    <article
                      key={`${category}-${task.id}`}
                      className="group cursor-pointer rounded-lg border border-white/5 bg-white/5 p-3 transition-all hover:border-[#622faf]/40"
                    >
                      <div className="flex items-start justify-between gap-3 pb-2">
                        <div className="flex flex-1 items-center gap-2">
                          <button
                            type="button"
                            className="text-[16px] text-slate-500 transition-colors hover:text-red-400"
                            aria-label="Delete task"
                            onClick={() => removeDraftTask(task.id)}
                          >
                            ⌫
                          </button>
                          <input
                            className="w-full border-none bg-transparent p-0 text-sm font-medium leading-tight text-slate-100 outline-none placeholder:text-slate-500 focus:ring-0"
                            value={task.title}
                            placeholder="Task name..."
                            onChange={(event) =>
                              updateDraftTitle(task.id, event.target.value)
                            }
                          />
                        </div>
                        <button
                          type="button"
                          className="flex items-center rounded border border-white/10 bg-white/5 px-1.5 py-0.5 transition-colors hover:bg-white/10"
                          onClick={() => updateDraftPriority(task.id)}
                          aria-label="Cycle difficulty"
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority]}`}
                          />
                          <span className="ml-1 text-[14px] text-slate-400">
                            ˅
                          </span>
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {INVENTORY_CATEGORY_ORDER.map((option) => {
                          const selected = task.categories.includes(option);
                          return (
                            <button
                              key={`${task.id}-${option}`}
                              type="button"
                              className={`rounded-full border px-2 py-0.5 text-[10px] ${
                                selected
                                  ? "border-[#622faf]/70 bg-[#622faf]/20 text-[#d4b3ff]"
                                  : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                              }`}
                              onClick={() =>
                                toggleDraftCategory(task.id, option)
                              }
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  ),
                )}
              </div>

              <button
                type="button"
                className="group flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-2.5 text-sm font-medium text-slate-500 transition-all hover:border-[#622faf]/60 hover:text-[#622faf]"
                onClick={() => addTask(category)}
              >
                <span className="text-base leading-none">＋</span>
                Add New Task
              </button>
            </section>
          ))}

          <section className="flex h-full flex-col rounded-xl border border-[rgba(98,47,175,0.2)] bg-[linear-gradient(to_bottom_right,rgba(98,47,175,0.10),transparent)] p-5 backdrop-blur-[12px] md:col-span-2">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#622faf]">
              <span>ⓘ</span>
              Blueprinting Guidelines
            </div>
            <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-2">
              <div className="space-y-4">
                <p className="text-slate-300">
                  You are in <strong className="text-white">Draft Mode</strong>.
                  Any changes made here are local and won&apos;t affect the live
                  roadmap until finalized.
                </p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-400">Low</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-xs text-slate-400">Medium</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#622faf]" />
                    <span className="text-xs text-slate-400">High</span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-white/5 bg-black/20 p-4">
                <h4 className="mb-2 flex items-center gap-2 font-bold text-slate-100">
                  <span>✦</span>
                  AI Suggestion
                </h4>
                <p className="text-xs italic text-slate-400">
                  &quot;Based on your specs, I&apos;ve added foundational tasks.
                  You can click + to append custom logic before
                  delegation.&quot;
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-[60] p-4">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between rounded-2xl border border-[rgba(98,47,175,0.2)] bg-[rgba(24,19,31,0.7)] p-4 shadow-2xl shadow-[#622faf]/20 backdrop-blur-[12px]">
          <div className="hidden flex-col md:flex">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {mode === "edit" ? "Edit Session Active" : "Inventory Status"}
            </span>
            <span className="text-sm font-medium text-slate-100">
              {mode === "edit"
                ? "Unsaved changes in Blueprint"
                : `${committedTasks.length} Tasks Prepared for Delegation`}
            </span>
          </div>
          <div className="flex w-full items-center gap-3 md:w-auto">
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-100 transition-all hover:bg-slate-800 md:flex-none"
              onClick={() => exportTasks(activeTasks, projectId)}
              disabled={activeTasks.length === 0}
            >
              Export Draft
            </button>
            {mode === "edit" ? (
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#622faf] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#622faf]/30 transition-all hover:bg-[#622faf]/90 md:flex-none"
                onClick={saveChanges}
              >
                Save Changes
                <span>✓</span>
              </button>
            ) : (
              <button
                type="button"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#622faf] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-[#622faf]/30 transition-all hover:bg-[#622faf]/90 md:flex-none"
                onClick={() => {
                  router.push(`/projects/${projectId}/workspace`);
                }}
              >
                Proceed to Delegation
                <span>→</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {statusMessage ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] mx-auto w-fit rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {statusMessage}
        </div>
      ) : null}
    </div>
  );
}
