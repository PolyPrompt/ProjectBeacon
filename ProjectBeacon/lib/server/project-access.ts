import { HttpError } from "@/lib/server/errors";
import { supabaseRestGet } from "@/lib/server/supabase-rest";

export type ProjectRole = "admin" | "user";

type ProjectMemberRoleRow = {
  role: string;
};

function normalizeProjectRole(role: string): ProjectRole {
  if (role === "owner" || role === "admin") {
    return "admin";
  }

  return "user";
}

export async function requireProjectMembership(
  projectId: string,
  userId: string,
): Promise<{ role: ProjectRole }> {
  const memberRows = await supabaseRestGet<ProjectMemberRoleRow[]>(
    `project_members?select=role&project_id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );

  const memberRow = memberRows.at(0);

  if (!memberRow) {
    throw new HttpError(403, "FORBIDDEN", "Project membership is required.");
  }

  return {
    role: normalizeProjectRole(memberRow.role),
  };
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
