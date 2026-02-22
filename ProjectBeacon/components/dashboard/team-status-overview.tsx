import type { TaskStatus } from "@/types/dashboard";

type TeamStatusOverviewProps = {
  members: Array<{
    userId: string;
    name: string;
    email: string;
    role: "owner" | "member";
  }>;
  tasks: Array<{
    assigneeUserId: string | null;
    status: TaskStatus;
  }>;
  viewerUserId: string;
};

type MemberStatus = {
  label: "On Track" | "In Progress" | "Needs Support" | "Awaiting Work";
  className: string;
};

function resolveMemberStatus(taskStatuses: TaskStatus[]): MemberStatus {
  if (taskStatuses.length === 0) {
    return {
      label: "Awaiting Work",
      className: "bg-slate-500/20 text-slate-300",
    };
  }

  if (taskStatuses.includes("blocked")) {
    return {
      label: "Needs Support",
      className: "bg-rose-500/15 text-rose-300",
    };
  }

  if (taskStatuses.every((status) => status === "done")) {
    return {
      label: "On Track",
      className: "bg-emerald-500/15 text-emerald-300",
    };
  }

  return {
    label: "In Progress",
    className: "bg-amber-500/15 text-amber-300",
  };
}

export function TeamStatusOverview({
  members,
  tasks,
  viewerUserId,
}: TeamStatusOverviewProps) {
  const tasksByAssignee = new Map<string, TaskStatus[]>();

  for (const task of tasks) {
    if (!task.assigneeUserId) {
      continue;
    }

    const current = tasksByAssignee.get(task.assigneeUserId) ?? [];
    current.push(task.status);
    tasksByAssignee.set(task.assigneeUserId, current);
  }

  return (
    <section className="sticky top-24 overflow-hidden rounded-2xl border border-violet-900/50 bg-[#1a1730]/85">
      <div className="border-b border-violet-900/50 px-4 py-3">
        <h2 className="text-base font-semibold text-white">
          Team Status Overview
        </h2>
      </div>

      {members.length === 0 ? (
        <p className="px-4 py-5 text-sm text-slate-300">
          No team members assigned yet.
        </p>
      ) : (
        <ul className="space-y-3 p-4">
          {members.map((member) => {
            const statuses = tasksByAssignee.get(member.userId) ?? [];
            const status = resolveMemberStatus(statuses);

            return (
              <li
                key={member.userId}
                className="flex items-center gap-3 rounded-lg border border-violet-900/40 bg-violet-900/10 p-3"
              >
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-violet-900/50 text-xs font-bold text-violet-100">
                  {member.name.slice(0, 2).toUpperCase()}
                  {member.userId === viewerUserId ? (
                    <span className="absolute -bottom-1 -right-1 rounded-full border border-[#1a1730] bg-violet-400 px-1 text-[9px] font-black text-[#1a1730]">
                      You
                    </span>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {member.name}
                  </p>
                  <p className="truncate text-xs text-slate-300">
                    {member.role === "owner" ? "Project Owner" : "Team Member"}
                  </p>
                </div>

                <span
                  className={`inline-flex rounded px-2 py-1 text-[10px] font-semibold ${status.className}`}
                >
                  {status.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
