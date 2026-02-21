import type { DashboardTeamStatus } from "@/types/dashboard";

type TeamStatusOverviewProps = {
  teamStatus: DashboardTeamStatus;
};

const STATUS_LABELS: Array<{
  key: keyof DashboardTeamStatus;
  label: string;
  className: string;
}> = [
  { key: "todo", label: "To Do", className: "bg-slate-100 text-slate-700" },
  {
    key: "inProgress",
    label: "In Progress",
    className: "bg-sky-100 text-sky-700",
  },
  { key: "blocked", label: "Blocked", className: "bg-rose-100 text-rose-700" },
  { key: "done", label: "Done", className: "bg-emerald-100 text-emerald-700" },
];

export function TeamStatusOverview({ teamStatus }: TeamStatusOverviewProps) {
  const totalTasks =
    teamStatus.todo +
    teamStatus.inProgress +
    teamStatus.blocked +
    teamStatus.done;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          Team Status Overview
        </h2>
        <p className="text-xs font-medium text-slate-500">
          {totalTasks} tasks tracked
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_LABELS.map((status) => (
          <article
            key={status.key}
            className={`rounded-xl px-3 py-3 text-center text-sm ${status.className}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide">
              {status.label}
            </p>
            <p className="mt-1 text-2xl font-bold">{teamStatus[status.key]}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Mini-Board Snapshot
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {STATUS_LABELS.map((status) => (
            <span
              key={status.key}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
            >
              {status.label}: {teamStatus[status.key]}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
