import { HttpError } from "@/lib/server/errors";
import { selectSingle } from "@/lib/server/supabase-rest";

export type ProjectRole = "admin" | "user";

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

export function normalizeProjectRole(role: string): ProjectRole {
  if (role === "owner" || role === "admin") {
    return "admin";
  }

  return "user";
}

export function roleCapabilities(role: ProjectRole): {
  role: ProjectRole;
  canManageProject: boolean;
  canEditWorkflow: boolean;
} {
  const isAdmin = role === "admin";

  return {
    role,
    canManageProject: isAdmin,
    canEditWorkflow: isAdmin,
  };
}

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

export async function requireProjectMembership(
  projectId: string,
  userId: string,
): Promise<{ role: ProjectRole; membership: ProjectMemberRow }> {
  const membership = await getProjectMembership(projectId, userId);

  if (!membership) {
    throw new HttpError(403, "FORBIDDEN", "Project membership is required.");
  }

  return {
    role: normalizeProjectRole(membership.role),
    membership,
  };
}
