import Link from "next/link";

type ProjectSummaryCardProps = {
  projectId: string;
  project: {
    id: string;
    name: string;
    description: string;
    deadline: string;
    planningStatus: "draft" | "locked" | "assigned";
  };
};

function planningStatusClass(status: "draft" | "locked" | "assigned") {
  if (status === "assigned") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "locked") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

export function ProjectSummaryCard({
  projectId,
  project,
}: ProjectSummaryCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">
            {project.name}
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            {project.description}
          </p>
          <p className="text-xs text-slate-500">
            Deadline: {new Date(project.deadline).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${planningStatusClass(project.planningStatus)}`}
          >
            {project.planningStatus}
          </span>
          <Link
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            href={`/projects/${projectId}/settings`}
          >
            Share
          </Link>
        </div>
      </div>
    </section>
  );
}
