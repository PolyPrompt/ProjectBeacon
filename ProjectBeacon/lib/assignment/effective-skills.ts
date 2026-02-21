import { selectRows } from "@/lib/server/supabase-rest";
import type { MemberEffectiveSkills } from "@/lib/assignment/assign-tasks";
import type { TaskRow } from "@/types/planning";

type ProjectMemberRow = {
  user_id: string;
  role: "owner" | "member";
};

type ProjectMemberSkillRow = {
  user_id: string;
  skill_id: string;
  level: number;
};

type UserSkillRow = {
  user_id: string;
  skill_id: string;
  level: number;
};

export async function loadProjectMembers(
  projectId: string,
): Promise<ProjectMemberRow[]> {
  return selectRows<ProjectMemberRow>("project_members", {
    select: "user_id,role",
    project_id: `eq.${projectId}`,
  });
}

export async function loadEffectiveMemberSkills(
  projectId: string,
  members: ProjectMemberRow[],
  tasks: TaskRow[],
): Promise<MemberEffectiveSkills[]> {
  if (members.length === 0) {
    return [];
  }

  const memberIds = members.map((member) => member.user_id);
  const inFilter = `in.(${memberIds.join(",")})`;

  const [projectOverrides, userSkills] = await Promise.all([
    selectRows<ProjectMemberSkillRow>("project_member_skills", {
      select: "user_id,skill_id,level",
      project_id: `eq.${projectId}`,
      user_id: inFilter,
    }),
    selectRows<UserSkillRow>("user_skills", {
      select: "user_id,skill_id,level",
      user_id: inFilter,
    }),
  ]);

  const loadByUser = new Map<string, number>();
  for (const task of tasks) {
    if (!task.assignee_user_id) {
      continue;
    }
    if (task.status === "done") {
      continue;
    }

    const current = loadByUser.get(task.assignee_user_id) ?? 0;
    loadByUser.set(task.assignee_user_id, current + task.difficulty_points);
  }

  const userSkillMap = new Map<string, Record<string, number>>();
  for (const skill of userSkills) {
    const existing = userSkillMap.get(skill.user_id) ?? {};
    existing[skill.skill_id] = skill.level;
    userSkillMap.set(skill.user_id, existing);
  }

  for (const override of projectOverrides) {
    const existing = userSkillMap.get(override.user_id) ?? {};
    existing[override.skill_id] = override.level;
    userSkillMap.set(override.user_id, existing);
  }

  return members
    .map((member) => ({
      userId: member.user_id,
      skills: userSkillMap.get(member.user_id) ?? {},
      currentLoad: loadByUser.get(member.user_id) ?? 0,
    }))
    .sort((left, right) => left.userId.localeCompare(right.userId));
}
