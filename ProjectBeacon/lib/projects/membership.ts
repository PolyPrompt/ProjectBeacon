import type { SessionUser } from "@/lib/auth/clerk-auth";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProjectMembershipRecord = {
  project_id: string;
  user_id: string;
  role: string;
};

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
