import type { SessionUser } from "@/lib/auth/clerk-auth";
import { ApiHttpError } from "@/lib/api/errors";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectRole = "owner" | "member" | "admin" | "user";

export type ProjectMembership = {
  projectId: string;
  userId: string;
  role: ProjectRole;
};

type ProjectMembershipRecord = {
  project_id: string;
  user_id: string;
  role: string;
};

function toProjectMembership(
  record: ProjectMembershipRecord,
): ProjectMembership {
  return {
    projectId: record.project_id,
    userId: record.user_id,
    role: record.role as ProjectRole,
  };
}

export async function resolveActorUserId(
  supabase: SupabaseClient,
  sessionUser: SessionUser,
): Promise<string | null> {
  if (sessionUser.localUserId) {
    return sessionUser.localUserId;
  }

  if (!sessionUser.email) {
    return null;
  }

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("email", sessionUser.email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

export async function getProjectMembership(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<ProjectMembershipRecord | null> {
  const { data, error } = await supabase
    .from("project_members")
    .select("project_id,user_id,role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function countProjectAdmins(
  supabase: SupabaseClient,
  projectId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("project_members")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .in("role", ["admin", "owner"]);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function requireProjectMember(
  projectId: string,
  userId: string,
): Promise<ProjectMembership> {
  const supabase = getServiceSupabaseClient();

  const record = await getProjectMembership(supabase, projectId, userId);

  if (!record) {
    throw new ApiHttpError(
      403,
      "FORBIDDEN",
      "You are not a member of this project",
    );
  }

  return toProjectMembership(record);
}

export async function requireProjectOwner(
  projectId: string,
  userId: string,
): Promise<ProjectMembership> {
  const membership = await requireProjectMember(projectId, userId);

  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new ApiHttpError(
      403,
      "FORBIDDEN",
      "Only project owners can perform this action",
    );
  }

  return membership;
}
