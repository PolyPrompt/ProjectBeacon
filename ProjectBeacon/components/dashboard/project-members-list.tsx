type ProjectMembersListProps = {
  members: Array<{
    userId: string;
    name: string;
    email: string;
    role: "owner" | "member";
  }>;
};

export function ProjectMembersList({ members }: ProjectMembersListProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Members</h2>

      {members.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No members added yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {members.map((member) => (
            <li
              key={member.userId}
              className="rounded-lg border border-slate-200 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">
                  {member.name}
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-700">
                  {member.role}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{member.email}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
