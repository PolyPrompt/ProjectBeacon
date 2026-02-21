import { ProjectSummary } from "@/types/dashboard";

type ProjectSummaryCardProps = {
  project: ProjectSummary;
  onShare: () => void;
};

const statusStyles: Record<ProjectSummary["planningStatus"], string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  locked: "border-sky-200 bg-sky-50 text-sky-700",
  assigned: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function ProjectSummaryCard({ project, onShare }: ProjectSummaryCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Project Summary</p>
          <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
          <p className="text-sm leading-6 text-slate-600">{project.description}</p>
        </div>
        <button
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          onClick={onShare}
          type="button"
        >
          Share
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
          Deadline: {new Date(project.deadline).toLocaleDateString()}
        </span>
        <span className={`rounded-lg border px-3 py-1 font-semibold capitalize ${statusStyles[project.planningStatus]}`}>
          {project.planningStatus}
        </span>
      </div>
    </section>
  );
}
