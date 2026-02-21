import { ProjectMember, ProjectTask } from "@/types/dashboard";

type ProjectTaskListProps = {
  tasks: ProjectTask[];
  members: ProjectMember[];
};

const statusStyles: Record<ProjectTask["status"], string> = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-100 text-amber-700",
  blocked: "bg-rose-100 text-rose-700",
  done: "bg-emerald-100 text-emerald-700",
};

export function ProjectTaskList({ tasks, members }: ProjectTaskListProps) {
  const membersById = new Map(members.map((member) => [member.userId, member.name]));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Tasks</h2>
        <span className="text-xs font-medium text-slate-500">{tasks.length} items</span>
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          No tasks yet. Generate a draft in the workspace below.
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li className="rounded-xl border border-slate-200 p-3" key={task.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                <span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${statusStyles[task.status]}`}>
                  {task.status.replace("_", " ")}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Difficulty: {task.difficultyPoints}</span>
                <span>•</span>
                <span>
                  Assignee: {task.assigneeUserId ? membersById.get(task.assigneeUserId) ?? "Unknown" : "Unassigned"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
