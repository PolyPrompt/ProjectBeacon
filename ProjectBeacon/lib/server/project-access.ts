import { selectSingle } from "@/lib/server/supabase-rest";

export type ProjectMemberRow = {
  id: string;
  project_id: string;
  user_id: string;
  role: "owner" | "member";
};

export type ProjectRow = {
  id: string;
  name: string;
  description: string;
  deadline: string;
  owner_user_id: string;
  planning_status: "draft" | "locked" | "assigned";
  created_at: string;
  updated_at: string;
};

export async function getProjectById(
  projectId: string,
): Promise<ProjectRow | null> {
  return selectSingle<ProjectRow>("projects", {
    select: "*",
    id: `eq.${projectId}`,
  });
}

export async function getProjectMembership(
  projectId: string,
  userId: string,
): Promise<ProjectMemberRow | null> {
  return selectSingle<ProjectMemberRow>("project_members", {
    select: "*",
    project_id: `eq.${projectId}`,
    user_id: `eq.${userId}`,
  });
}
