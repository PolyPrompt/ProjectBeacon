type ProjectTaskListProps = {
  members: Array<{
    userId: string;
    name: string;
    email: string;
    role: "owner" | "member";
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    assigneeUserId: string | null;
    difficultyPoints: 1 | 2 | 3 | 5 | 8;
  }>;
};

export function ProjectTaskList({ members, tasks }: ProjectTaskListProps) {
  const memberNameById = new Map(
    members.map((member) => [member.userId, member.name]),
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>

      {tasks.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No tasks generated yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="rounded-lg border border-slate-200 px-3 py-2"
            >
              <p className="text-sm font-semibold text-slate-900">
                {task.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Status: {task.status} · Difficulty: {task.difficultyPoints} ·
                Assignee:{" "}
                {task.assigneeUserId
                  ? (memberNameById.get(task.assigneeUserId) ??
                    task.assigneeUserId)
                  : "Unassigned"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
