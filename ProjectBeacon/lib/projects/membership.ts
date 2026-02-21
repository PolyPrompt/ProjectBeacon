import { ApiHttpError } from "@/lib/api/errors";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export type ProjectRole = "owner" | "member";

export type ProjectMembership = {
  projectId: string;
  userId: string;
  role: ProjectRole;
};

export async function requireProjectMember(
  projectId: string,
  userId: string,
): Promise<ProjectMembership> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from("project_members")
    .select("project_id,user_id,role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new ApiHttpError(
      500,
      "DB_ERROR",
      "Failed to load project membership",
      error.message,
    );
  }

  if (!data) {
    throw new ApiHttpError(
      403,
      "FORBIDDEN",
      "You are not a member of this project",
    );
  }

  return {
    projectId: data.project_id,
    userId: data.user_id,
    role: data.role,
  };
}

export async function requireProjectOwner(
  projectId: string,
  userId: string,
): Promise<ProjectMembership> {
  const membership = await requireProjectMember(projectId, userId);

  if (membership.role !== "owner") {
    throw new ApiHttpError(
      403,
      "FORBIDDEN",
      "Only project owners can perform this action",
    );
  }

  return membership;
}
