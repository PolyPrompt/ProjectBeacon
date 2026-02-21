import type { MyTaskDTO } from "@/types/dashboard";

type MyTasksPanelProps = {
  tasks: MyTaskDTO[];
  selectedTaskId: string | null;
  onTaskSelect: (task: MyTaskDTO) => void;
};

function statusBadgeClass(status: MyTaskDTO["status"]): string {
  if (status === "done") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "in_progress") {
    return "bg-sky-100 text-sky-700";
  }
  if (status === "blocked") {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-slate-100 text-slate-700";
}

function formatDeadline(value: string | null): string {
  if (!value) {
    return "No soft deadline";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MyTasksPanel({
  tasks,
  selectedTaskId,
  onTaskSelect,
}: MyTasksPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">My Tasks</h2>
        <p className="text-xs font-medium text-slate-500">
          Sorted by soft deadline
        </p>
      </div>

      {tasks.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No assigned tasks yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Task</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Soft Deadline</th>
                <th className="px-2 py-2">Difficulty</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const isSelected = task.id === selectedTaskId;

                return (
                  <tr
                    key={task.id}
                    className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 ${isSelected ? "bg-sky-50" : ""}`}
                    onClick={() => onTaskSelect(task)}
                  >
                    <td className="px-2 py-3 font-medium text-slate-900">
                      {task.title}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(task.status)}`}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-slate-700">
                      {formatDeadline(task.softDeadline)}
                    </td>
                    <td className="px-2 py-3 text-slate-700">
                      {task.difficultyPoints}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
