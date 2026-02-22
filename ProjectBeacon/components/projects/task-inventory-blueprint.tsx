"use client";

import { useEffect, useMemo, useState } from "react";

import {
  INVENTORY_CATEGORY_ORDER,
  inferInventoryCategories,
  isInventoryCategory,
  type InventoryCategory,
} from "@/lib/tasks/inventory-categories";
import type { WorkflowBoardDTO, WorkflowBoardTaskDTO } from "@/types/workflow";

type PlanningStatus = "draft" | "locked" | "assigned";
type InventoryMode = "review" | "edit";
type InventoryPriority = "low" | "medium" | "high";

type TaskInventoryBlueprintProps = {
  isProceeding: boolean;
  onProceedToDelegation: () => void | Promise<void>;
  planningStatus: PlanningStatus;
  projectId: string;
  refreshToken?: number;
};

type InventoryTask = {
  assignee: string;
  categories: InventoryCategory[];
  id: string;
  phase: WorkflowBoardTaskDTO["phase"];
  priority: InventoryPriority;
  sourceTaskId: string | null;
  status: WorkflowBoardTaskDTO["status"];
  title: string;
};

const CATEGORY_COLORS: Record<InventoryPriority, string> = {
  low: "bg-emerald-400",
  medium: "bg-amber-400",
  high: "bg-violet-400",
};

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
      assignee: column.name,
      categories: inferInventoryCategories(task),
      id: task.id,
      phase: task.phase,
      priority: mapDifficultyToPriority(task.difficultyPoints),
      sourceTaskId: task.id,
      status: task.status,
      title: task.title,
    })),
  );

  const unassigned = board.unassigned.map((task) => ({
    assignee: "Unassigned",
    categories: inferInventoryCategories(task),
    id: task.id,
    phase: task.phase,
    priority: mapDifficultyToPriority(task.difficultyPoints),
    sourceTaskId: task.id,
    status: task.status,
    title: task.title,
  }));

  return [...assigned, ...unassigned].sort((left, right) =>
    left.title.localeCompare(right.title),
  );
}

function cloneTasks(tasks: InventoryTask[]): InventoryTask[] {
  return tasks.map((task) => ({ ...task, categories: [...task.categories] }));
}

function validateTasks(tasks: InventoryTask[]): string[] {
  if (tasks.length === 0) {
    return ["At least one task is required before delegation."];
  }

  return tasks.flatMap((task) => {
    const errors: string[] = [];

    if (task.title.trim().length < 3) {
      errors.push(
        `Task \"${task.id}\" needs a title with at least 3 characters.`,
      );
    }

    if (task.categories.length === 0) {
      errors.push(
        `Task \"${task.title || task.id}\" must include at least one category.`,
      );
    }

    if (!task.categories.every((category) => isInventoryCategory(category))) {
      errors.push(
        `Task \"${task.title || task.id}\" is missing a valid category.`,
      );
    }

    return errors;
  });
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

export default function TaskInventoryBlueprint({
  isProceeding,
  onProceedToDelegation,
  planningStatus,
  projectId,
  refreshToken = 0,
}: TaskInventoryBlueprintProps) {
  const [mode, setMode] = useState<InventoryMode>("review");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [committedTasks, setCommittedTasks] = useState<InventoryTask[]>([]);
  const [draftTasks, setDraftTasks] = useState<InventoryTask[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadInventory(): Promise<void> {
      setIsLoading(true);
      setError(null);
      setStatusMessage(null);

      try {
        const response = await fetch(
          `/api/projects/${projectId}/workflow/board`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const payload = parseBoardPayload((await response.json()) as unknown);
        if (!response.ok || !payload) {
          throw new Error(
            "Unable to load generated tasks for blueprint review.",
          );
        }

        if (!cancelled) {
          const tasks = toInventoryTasks(payload);
          setCommittedTasks(tasks);
          setDraftTasks(cloneTasks(tasks));
          setMode("review");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load task inventory.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadInventory();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId, refreshToken]);

  const activeTasks = mode === "edit" ? draftTasks : committedTasks;
  const groupedTasks = useMemo(
    () =>
      INVENTORY_CATEGORY_ORDER.map((category) => ({
        category,
        tasks: activeTasks.filter((task) => task.categories.includes(category)),
      })),
    [activeTasks],
  );

  const committedErrors = useMemo(
    () => validateTasks(committedTasks),
    [committedTasks],
  );
  const draftErrors = useMemo(() => validateTasks(draftTasks), [draftTasks]);

  const canProceed =
    mode === "review" &&
    !isLoading &&
    !isProceeding &&
    committedErrors.length === 0 &&
    planningStatus !== "assigned";

  const canSave = mode === "edit" && draftErrors.length === 0 && !isSaving;

  const proceedLabel =
    planningStatus === "locked"
      ? "Run Final Assignment"
      : planningStatus === "assigned"
        ? "Delegation Complete"
        : "Proceed to Delegation";

  function openEditMode(): void {
    setDraftTasks(cloneTasks(committedTasks));
    setMode("edit");
    setStatusMessage(null);
  }

  function exitEditMode(): void {
    setDraftTasks(cloneTasks(committedTasks));
    setMode("review");
    setStatusMessage("Discarded unsaved blueprint edits.");
  }

  function addTask(category: InventoryCategory): void {
    const newTask: InventoryTask = {
      assignee: "Unassigned",
      categories: [category],
      id: createDraftId(),
      phase: "middle",
      priority: "medium",
      sourceTaskId: null,
      status: "todo",
      title: "",
    };

    if (mode === "review") {
      setDraftTasks([...cloneTasks(committedTasks), newTask]);
      setMode("edit");
      return;
    }

    setDraftTasks((previous) => [...previous, newTask]);
  }

  function removeDraftTask(taskId: string): void {
    setDraftTasks((previous) => previous.filter((task) => task.id !== taskId));
  }

  function updateDraftTask(
    taskId: string,
    patch: Partial<Pick<InventoryTask, "categories" | "priority" | "title">>,
  ): void {
    setDraftTasks((previous) =>
      previous.map((task) =>
        task.id === taskId ? { ...task, ...patch } : task,
      ),
    );
  }

  function toggleDraftTaskCategory(
    taskId: string,
    category: InventoryCategory,
  ): void {
    const target = draftTasks.find((task) => task.id === taskId);
    if (!target) {
      return;
    }

    const nextCategories = target.categories.includes(category)
      ? target.categories.filter((value) => value !== category)
      : [...target.categories, category];

    updateDraftTask(taskId, { categories: nextCategories });
  }

  function saveChanges(): void {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const normalized = draftTasks.map((task) => ({
      ...task,
      title: task.title.trim(),
    }));

    setCommittedTasks(normalized);
    setDraftTasks(cloneTasks(normalized));
    setMode("review");
    setStatusMessage("Saved local blueprint edits.");
    setIsSaving(false);
  }

  async function proceed(): Promise<void> {
    if (!canProceed) {
      return;
    }

    setError(null);
    setStatusMessage(null);

    try {
      await onProceedToDelegation();
    } catch (proceedError) {
      setError(
        proceedError instanceof Error
          ? proceedError.message
          : "Unable to continue to delegation.",
      );
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-[#111321] p-5">
        <h3 className="text-lg font-semibold text-slate-100">
          Task Inventory Blueprint
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Loading generated task inventory...
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-800 bg-[#0f1220] p-5 shadow-[0_24px_80px_rgba(9,12,30,0.45)]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h3 className="text-3xl font-bold tracking-tight text-slate-100">
            Task Inventory Blueprint
          </h3>
          <p className="max-w-3xl text-sm text-slate-400">
            Review and refine AI-generated tasks before final delegation.
            Changes stay local until you proceed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mode === "edit" ? (
            <button
              type="button"
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-slate-100"
              onClick={exitEditMode}
            >
              Exit Edit Mode
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-violet-400 hover:text-slate-100"
            onClick={openEditMode}
            disabled={mode === "edit"}
          >
            Edit Specs
          </button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groupedTasks.map(({ category, tasks }) => (
          <section
            key={category}
            className="rounded-xl border border-violet-500/20 bg-[#171a2b] p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h4 className="text-lg font-semibold text-slate-100">
                {category}
              </h4>
              <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200">
                {tasks.length} task{tasks.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="space-y-2">
              {tasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-xs text-slate-500">
                  No tasks in this category yet.
                </p>
              ) : (
                tasks.map((task) => (
                  <article
                    key={`${category}-${task.id}`}
                    className="rounded-lg border border-slate-700 bg-slate-950/30 px-3 py-2"
                  >
                    {mode === "edit" ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded border border-slate-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 transition hover:border-red-400 hover:text-red-300"
                            onClick={() => removeDraftTask(task.id)}
                          >
                            Remove
                          </button>
                          <input
                            className="w-full rounded-md border border-slate-700 bg-[#0f1220] px-2 py-1.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-400"
                            value={task.title}
                            onChange={(event) =>
                              updateDraftTask(task.id, {
                                title: event.target.value,
                              })
                            }
                            placeholder="Task title"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                            {task.assignee}
                          </span>
                          <label className="flex items-center gap-2 text-xs text-slate-400">
                            Priority
                            <select
                              className="rounded border border-slate-700 bg-[#0f1220] px-2 py-1 text-xs text-slate-200 outline-none"
                              value={task.priority}
                              onChange={(event) =>
                                updateDraftTask(task.id, {
                                  priority: event.target
                                    .value as InventoryPriority,
                                })
                              }
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {INVENTORY_CATEGORY_ORDER.map((option) => {
                            const selected = task.categories.includes(option);
                            return (
                              <button
                                key={`${task.id}-${option}`}
                                type="button"
                                className={`rounded-full border px-2 py-1 text-[10px] font-medium ${
                                  selected
                                    ? "border-violet-400/70 bg-violet-500/20 text-violet-100"
                                    : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                                }`}
                                onClick={() =>
                                  toggleDraftTaskCategory(task.id, option)
                                }
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-100">
                            {task.title}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {task.categories.map((taskCategory) => (
                              <span
                                key={`${task.id}-${taskCategory}`}
                                className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300"
                              >
                                {taskCategory}
                              </span>
                            ))}
                          </div>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                            {task.assignee} · {task.status.replace("_", " ")}
                          </p>
                        </div>
                        <span
                          className={`mt-1 h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS[task.priority]}`}
                          aria-hidden="true"
                        />
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>

            <button
              type="button"
              className="mt-3 w-full rounded-lg border border-dashed border-slate-600 px-3 py-2 text-sm text-slate-400 transition hover:border-violet-400 hover:text-violet-200"
              onClick={() => addTask(category)}
            >
              + Add New Task
            </button>
          </section>
        ))}

        <section className="rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-transparent p-4 md:col-span-2 xl:col-span-1">
          <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
            Blueprinting Guidelines
          </h4>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            You are in draft mode. Changes stay local to this workspace until
            delegation is confirmed.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Low
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Medium
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-400" /> High
            </span>
          </div>
          <p className="mt-4 rounded-lg border border-slate-700 bg-slate-950/30 px-3 py-2 text-xs italic text-slate-400">
            &quot;You can reorder and refine tasks before locking delegation.
            Save edits before proceeding.&quot;
          </p>
        </section>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {mode === "edit" && draftErrors.length > 0 ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Resolve validation before saving: {draftErrors[0]}
        </p>
      ) : null}

      {mode === "review" && committedErrors.length > 0 ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Delegation is blocked until validation passes: {committedErrors[0]}
        </p>
      ) : null}

      {statusMessage ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {statusMessage}
        </p>
      ) : null}

      <footer className="sticky bottom-3 z-20 rounded-2xl border border-violet-500/20 bg-[#15192a]/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {mode === "edit" ? "Edit Session Active" : "Inventory Status"}
            </p>
            <p className="text-sm text-slate-200">
              {mode === "edit"
                ? "Unsaved changes in blueprint"
                : `${committedTasks.length} tasks prepared for delegation`}
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 sm:flex-none"
              onClick={() => exportTasks(activeTasks, projectId)}
              disabled={activeTasks.length === 0}
            >
              Export Draft
            </button>

            {mode === "edit" ? (
              <button
                type="button"
                className="flex-1 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 sm:flex-none"
                onClick={saveChanges}
                disabled={!canSave}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            ) : (
              <button
                type="button"
                className="flex-1 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 sm:flex-none"
                onClick={() => {
                  void proceed();
                }}
                disabled={!canProceed}
              >
                {isProceeding ? "Processing..." : proceedLabel}
              </button>
            )}
          </div>
        </div>
      </footer>
    </section>
  );
}
