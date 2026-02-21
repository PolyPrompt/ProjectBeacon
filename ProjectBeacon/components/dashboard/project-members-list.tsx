import { ProjectMember } from "@/types/dashboard";

type ProjectMembersListProps = {
  members: ProjectMember[];
};

export function ProjectMembersList({ members }: ProjectMembersListProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Members</h2>
        <span className="text-xs font-medium text-slate-500">{members.length} total</span>
      </div>

      {members.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          No members found yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {members.map((member) => (
            <li className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3" key={member.userId}>
              <div>
                <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                <p className="text-xs text-slate-500">{member.email}</p>
              </div>
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${
                  member.role === "owner"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {member.role}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
