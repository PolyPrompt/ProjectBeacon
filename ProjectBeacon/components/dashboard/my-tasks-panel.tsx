import type { MyTaskDTO, TaskStatus } from "@/types/dashboard";
import Link from "next/link";

type MyTasksPanelProps = {
  tasks: MyTaskDTO[];
  selectedTaskId: string | null;
  onTaskSelect: (task: MyTaskDTO) => void;
  boardHref: string;
};

function toPriority(task: MyTaskDTO): "High" | "Medium" | "Low" {
  if (task.status === "blocked" || task.difficultyPoints >= 5) {
    return "High";
  }
  if (task.status === "in_progress" || task.difficultyPoints >= 3) {
    return "Medium";
  }
  return "Low";
}

function priorityClass(priority: "High" | "Medium" | "Low"): string {
  if (priority === "High") {
    return "bg-rose-500/15 text-rose-300";
  }

  if (priority === "Medium") {
    return "bg-sky-500/15 text-sky-300";
  }

  return "bg-emerald-500/15 text-emerald-300";
}

function formatDeadline(value: string | null): string {
  if (!value) {
    return "No soft deadline";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function statusHint(status: TaskStatus): string {
  if (status === "blocked") {
    return "Needs support to unblock dependencies.";
  }
  if (status === "in_progress") {
    return "Actively in implementation.";
  }
  if (status === "done") {
    return "Delivery ready and validated.";
  }

  return "Queued to begin once prerequisites are clear.";
}

export function MyTasksPanel({
  tasks,
  selectedTaskId,
  onTaskSelect,
  boardHref,
}: MyTasksPanelProps) {
  const visibleTasks = tasks.slice(0, 2);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-white">
          My Delegated Tasks
        </h2>
        <div className="flex items-center gap-4">
          {tasks.length > 2 ? (
            <Link
              className="text-xs font-semibold text-violet-300 transition hover:text-violet-200"
              href={boardHref}
            >
              View all
            </Link>
          ) : null}
        </div>
      </div>

      {visibleTasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-violet-700/70 bg-violet-900/10 p-4 text-sm text-slate-300">
          No delegated tasks are assigned to you yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleTasks.map((task) => {
            const priority = toPriority(task);
            const isSelected = task.id === selectedTaskId;

            return (
              <article
                key={task.id}
                className={`rounded-xl border p-4 transition ${
                  isSelected
                    ? "border-violet-400 bg-violet-700/20"
                    : "border-violet-900/50 bg-violet-900/15"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-100">
                    {task.title}
                  </h3>
                  <span
                    className={`inline-flex rounded px-2 py-1 text-[10px] font-bold uppercase ${priorityClass(priority)}`}
                  >
                    {priority}
                  </span>
                </div>

                <div className="mt-3 rounded-lg border-l-4 border-violet-400 bg-violet-500/10 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200">
                    AI Rationale
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    {statusHint(task.status)} Task difficulty is{" "}
                    {task.difficultyPoints} points with target date{" "}
                    {formatDeadline(task.softDeadline)}.
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-300">
                    Status:{" "}
                    <span className="font-medium">
                      {task.status.replace("_", " ")}
                    </span>
                  </p>
                  <button
                    className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-400"
                    onClick={() => onTaskSelect(task)}
                    type="button"
                  >
                    View Task
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
