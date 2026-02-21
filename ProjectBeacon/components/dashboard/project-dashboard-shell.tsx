"use client";

import Link from "next/link";

import { useWorkspaceDraft } from "@/lib/workspace/draft-store";
import {
  PlanningWorkspaceState,
  ProjectDashboardViewModel,
} from "@/types/dashboard";

type ProjectDashboardShellProps = {
  initialClarification: PlanningWorkspaceState["clarification"];
  initialViewModel: ProjectDashboardViewModel;
};

const statusStyles: Record<
  ProjectDashboardViewModel["project"]["planningStatus"],
  string
> = {
  draft: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  locked: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  assigned: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export function ProjectDashboardShell({
  initialClarification,
  initialViewModel,
}: ProjectDashboardShellProps) {
  const { draft } = useWorkspaceDraft({
    initialClarification,
    initialDescription: initialViewModel.project.description,
    initialPlanningStatus: initialViewModel.project.planningStatus,
    projectId: initialViewModel.project.id,
  });

  const project = {
    ...initialViewModel.project,
    planningStatus: draft.planningStatus,
  };

  return (
    <div className="pb-24">
      <header className="mb-8 rounded-2xl border border-white/10 bg-[#14101e]/80 p-6 shadow-[0_30px_90px_-45px_rgba(98,47,175,0.9)] backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Project Dashboard
            </p>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              {project.name}
            </h1>
            <p className="max-w-3xl text-sm text-slate-300 md:text-base">
              {project.description || "No project summary yet."}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusStyles[project.planningStatus]}`}
            >
              {project.planningStatus}
            </span>
            <Link
              className="rounded-xl bg-[#622faf] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7444bd]"
              href={`/projects/${project.id}/workspace/context`}
            >
              Open Workspace
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Deadline
            </p>
            <p className="mt-1 text-slate-100">
              {new Date(project.deadline).toLocaleDateString()}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Members
            </p>
            <p className="mt-1 text-slate-100">
              {initialViewModel.members.length}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Draft Tasks
            </p>
            <p className="mt-1 text-slate-100">{draft.tasks.length}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-[#622faf]/30 bg-[#18131f]/70 p-5 backdrop-blur-xl lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Team</h2>
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
              {initialViewModel.members.length}
            </span>
          </div>

          {initialViewModel.members.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/15 bg-black/20 p-4 text-sm text-slate-400">
              No members found yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {initialViewModel.members.map((member) => (
                <li
                  key={member.userId}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-slate-100">
                    {member.name}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-400">
                    <span className="truncate">{member.email}</span>
                    <span className="rounded border border-white/15 bg-white/5 px-2 py-0.5 uppercase">
                      {member.role}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#622faf]/30 bg-[#18131f]/70 p-5 backdrop-blur-xl lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Tasks</h2>
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
              {draft.tasks.length}
            </span>
          </div>

          {draft.tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/15 bg-black/20 p-4 text-sm text-slate-400">
              No tasks yet. Run the workspace flow to generate a draft.
            </p>
          ) : (
            <ul className="space-y-2">
              {draft.tasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5"
                >
                  <p className="text-sm font-medium text-slate-100">
                    {task.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {task.status} · difficulty {task.difficultyPoints}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#622faf]/30 bg-[#18131f]/70 p-5 backdrop-blur-xl lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Dependencies</h2>
            <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
              {draft.dependencyEdges.length}
            </span>
          </div>

          {draft.dependencyEdges.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/15 bg-black/20 p-4 text-sm text-slate-400">
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

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/35"
          href={`/projects/${project.id}/workspace/context`}
        >
          1. Context + Docs
        </Link>
        <Link
          className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/35"
          href={`/projects/${project.id}/workspace/clarify`}
        >
          2. Clarify
        </Link>
        <Link
          className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/35"
          href={`/projects/${project.id}/workspace/generate`}
        >
          3. Generate
        </Link>
        <Link
          className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/35"
          href={`/projects/${project.id}/workspace/review`}
        >
          4. Review
        </Link>
        <Link
          className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/35"
          href={`/projects/${project.id}/workspace/lock`}
        >
          5. Lock
        </Link>
        <Link
          className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/35"
          href={`/projects/${project.id}/workspace/assign`}
        >
          6. Assign
        </Link>
      </div>
    </div>
  );
}
