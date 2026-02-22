"use client";

import { useMemo, useState } from "react";

import { MyTasksPanel } from "@/components/dashboard/my-tasks-panel";
import { TaskDetailModal } from "@/components/dashboard/task-detail-modal";
import { TeamStatusOverview } from "@/components/dashboard/team-status-overview";
import type { MyTaskDTO, TaskStatus } from "@/types/dashboard";

export type DashboardProject = {
  id: string;
  name: string;
  description: string;
  deadline: string | null;
  planningStatus: "draft" | "locked" | "assigned";
};

export type DashboardMember = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
  inviteStatus: "accepted";
};

export type DashboardTask = MyTaskDTO & {
  assigneeUserId: string | null;
  createdAt: string | null;
};

type ProjectDashboardShellProps = {
  projectId: string;
  project: DashboardProject;
  members: DashboardMember[];
  tasks: DashboardTask[];
  viewerUserId: string;
  viewerRole: "admin" | "user";
};

type TaskHealth = "high" | "medium" | "low";

function toCountdownLabel(isoDate: string | null): string {
  if (!isoDate) {
    return "No deadline";
  }

  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) {
    return "Invalid deadline";
  }

  const diffMs = target - Date.now();
  if (diffMs <= 0) {
    return "Due now";
  }

  const totalHours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  return `${days}d ${String(hours).padStart(2, "0")}h`;
}

function statusChipClass(status: TaskStatus): string {
  if (status === "done") {
    return "bg-emerald-500/15 text-emerald-300";
  }
  if (status === "in_progress") {
    return "bg-amber-500/15 text-amber-300";
  }
  if (status === "blocked") {
    return "bg-rose-500/15 text-rose-300";
  }
  return "bg-slate-500/20 text-slate-300";
}

function healthForTask(task: DashboardTask): TaskHealth {
  if (task.status === "blocked") {
    return "high";
  }

  if (task.status === "in_progress" || task.difficultyPoints >= 5) {
    return "medium";
  }

  return "low";
}

function healthLabel(health: TaskHealth): string {
  if (health === "high") {
    return "High";
  }

  if (health === "medium") {
    return "Medium";
  }

  return "Low";
}

function healthClass(health: TaskHealth): string {
  if (health === "high") {
    return "bg-rose-500/15 text-rose-300";
  }

  if (health === "medium") {
    return "bg-sky-500/15 text-sky-300";
  }

  return "bg-emerald-500/15 text-emerald-300";
}

function toReadableDate(value: string | null): string {
  if (!value) {
    return "Unscheduled";
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

export function ProjectDashboardShell({
  projectId,
  project,
  members,
  tasks: initialTasks,
  viewerUserId,
  viewerRole,
}: ProjectDashboardShellProps) {
  const [tasks, setTasks] = useState<DashboardTask[]>(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  const myTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.assigneeUserId === viewerUserId)
        .sort((left, right) => {
          if (!left.softDeadline && !right.softDeadline) {
            return left.title.localeCompare(right.title);
          }
          if (!left.softDeadline) {
            return 1;
          }
          if (!right.softDeadline) {
            return -1;
          }

          return (
            new Date(left.softDeadline).getTime() -
            new Date(right.softDeadline).getTime()
          );
        }),
    [tasks, viewerUserId],
  );

  const nextMilestone = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== "done" && task.softDeadline)
        .sort(
          (left, right) =>
            new Date(left.softDeadline ?? 0).getTime() -
            new Date(right.softDeadline ?? 0).getTime(),
        )[0] ?? null,
    [tasks],
  );

  const backlogTasks = useMemo(
    () =>
      [...tasks].sort((left, right) => {
        const statusRank: Record<TaskStatus, number> = {
          in_progress: 0,
          blocked: 1,
          todo: 2,
          done: 3,
        };

        const byStatus = statusRank[left.status] - statusRank[right.status];
        if (byStatus !== 0) {
          return byStatus;
        }

        if (!left.softDeadline && !right.softDeadline) {
          return left.title.localeCompare(right.title);
        }
        if (!left.softDeadline) {
          return 1;
        }
        if (!right.softDeadline) {
          return -1;
        }

        return (
          new Date(left.softDeadline).getTime() -
          new Date(right.softDeadline).getTime()
        );
      }),
    [tasks],
  );

  return (
    <section className="space-y-6 rounded-3xl border border-violet-950/70 bg-gradient-to-b from-[#150f26] via-[#121127] to-[#160f28] p-5 text-slate-100 shadow-[0_24px_80px_rgba(8,6,18,0.65)] sm:p-6">
      <header className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-violet-500/25 bg-violet-500/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200/80">
            Next Milestone
          </p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-white">
                {nextMilestone?.title ?? "No active milestone"}
              </h1>
              <p className="mt-1 text-xs text-slate-300">
                {nextMilestone
                  ? `Due ${toReadableDate(nextMilestone.softDeadline)}`
                  : "All tracked tasks are complete or unscheduled."}
              </p>
            </div>
            <p className="text-xl font-bold text-violet-200">
              {toCountdownLabel(nextMilestone?.softDeadline ?? null)}
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-violet-500/25 bg-violet-500/10 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200/80">
            Final Submission
          </p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {project.name}
              </h2>
              <p className="mt-1 text-xs text-slate-300">
                Planning status: {project.planningStatus}
              </p>
            </div>
            <p className="text-xl font-bold text-violet-200">
              {toCountdownLabel(project.deadline)}
            </p>
          </div>
        </article>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <MyTasksPanel
            onTaskSelect={(task) => setSelectedTaskId(task.id)}
            selectedTaskId={selectedTaskId}
            tasks={myTasks}
            viewerRole={viewerRole}
          />

          <section className="overflow-hidden rounded-2xl border border-violet-900/50 bg-[#1a1730]/80">
            <div className="flex items-center justify-between border-b border-violet-900/40 px-4 py-3">
              <h2 className="text-base font-semibold text-white">
                Global Project Backlog
              </h2>
              <p className="text-xs font-medium text-violet-200/80">
                {backlogTasks.length} tasks
              </p>
            </div>

            {backlogTasks.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-300">
                No tasks in backlog yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-violet-900/20 text-[11px] uppercase tracking-[0.1em] text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Task Name</th>
                      <th className="px-4 py-3">Assigned</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Difficulty</th>
                      <th className="px-4 py-3">Deadline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-900/30">
                    {backlogTasks.map((task) => {
                      const assignee = task.assigneeUserId
                        ? (memberById.get(task.assigneeUserId)?.name ??
                          "Unknown")
                        : "Unassigned";

                      const health = healthForTask(task);

                      return (
                        <tr
                          key={task.id}
                          className={`cursor-pointer transition hover:bg-violet-900/20 ${
                            selectedTaskId === task.id ? "bg-violet-900/30" : ""
                          }`}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <td className="px-4 py-3 font-medium text-slate-100">
                            {task.title}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {assignee}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusChipClass(task.status)}`}
                            >
                              {task.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${healthClass(health)}`}
                            >
                              {healthLabel(health)} · {task.difficultyPoints}{" "}
                              pts
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {toReadableDate(task.softDeadline)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="lg:col-span-4">
          <TeamStatusOverview
            members={members}
            tasks={tasks}
            viewerUserId={viewerUserId}
          />
        </aside>
      </div>

      <TaskDetailModal
        onClose={() => setSelectedTaskId(null)}
        onTaskStatusChange={(taskId, status) => {
          setTasks((current) =>
            current.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    status,
                  }
                : task,
            ),
          );
        }}
        projectId={projectId}
        task={selectedTask}
        userIdHeaderValue={viewerUserId}
      />
    </section>
  );
}
