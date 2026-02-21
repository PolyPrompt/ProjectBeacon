"use client";

import { useMemo, useState } from "react";
import { MyTasksPanel } from "@/components/dashboard/my-tasks-panel";
import { TaskDetailModal } from "@/components/dashboard/task-detail-modal";
import { TeamStatusOverview } from "@/components/dashboard/team-status-overview";
import type { DashboardPageData } from "@/lib/workspace/page-data";
import type { MyTaskDTO } from "@/types/dashboard";

type ProjectDashboardShellProps = {
  projectId: string;
  initialData: DashboardPageData;
};

function toCountdownLabel(hours: number | null): string {
  if (hours === null) {
    return "Not available";
  }
  if (hours <= 0) {
    return "Due now";
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days === 0) {
    return `${remainingHours}h`;
  }
  if (remainingHours === 0) {
    return `${days}d`;
  }
  return `${days}d ${remainingHours}h`;
}

export function ProjectDashboardShell({
  projectId,
  initialData,
}: ProjectDashboardShellProps) {
  const [selectedTask, setSelectedTask] = useState<MyTaskDTO | null>(null);
  const { summary } = initialData;

  const nextMilestoneTask = useMemo(
    () => summary.myTasks.find((task) => task.softDeadline),
    [summary.myTasks],
  );

  return (
    <section className="space-y-5">
      {initialData.notices.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">
            {initialData.source === "scaffold"
              ? "Dashboard scaffold mode is active."
              : "Dashboard loaded with partial API data."}
          </p>
          <ul className="mt-2 list-disc pl-5">
            {initialData.notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Next Due Milestone
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {toCountdownLabel(summary.nextMilestoneCountdownHours)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {nextMilestoneTask
              ? `${nextMilestoneTask.title} · ${nextMilestoneTask.softDeadline ? new Date(nextMilestoneTask.softDeadline).toLocaleString() : "No date"}`
              : "No upcoming milestone yet"}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Final Submission
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {toCountdownLabel(summary.finalDeadlineCountdownHours)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Overall project deadline countdown
          </p>
        </article>
      </div>

      <MyTasksPanel
        onTaskSelect={(task) => setSelectedTask(task)}
        selectedTaskId={selectedTask?.id ?? null}
        tasks={summary.myTasks}
      />

      <TeamStatusOverview teamStatus={summary.teamStatus} />

      <TaskDetailModal
        onClose={() => setSelectedTask(null)}
        projectId={projectId}
        task={selectedTask}
      />
    </section>
  );
}
