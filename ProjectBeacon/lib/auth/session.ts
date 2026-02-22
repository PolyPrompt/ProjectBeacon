import { redirect } from "next/navigation";
import { ApiHttpError } from "@/lib/api/errors";
import {
  getE2EBypassRole,
  getE2EBypassUserId,
  isE2EAuthBypassEnabled,
} from "@/lib/auth/e2e-bypass";
import { normalizeProjectRole } from "@/lib/auth/project-role";
import { requireUser } from "@/lib/auth/require-user";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export type ProjectRole = "admin" | "user";

export type SessionUser = {
  userId: string;
  role: ProjectRole;
};

type SessionOptions = {
  projectId?: string;
};

type ProjectMembershipRoleRow = {
  role: string;
};

async function resolveProjectRole(
  userId: string,
  projectId: string | undefined,
): Promise<ProjectRole> {
  if (!projectId) {
    return "user";
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle<ProjectMembershipRoleRow>();

  if (error) {
    throw new ApiHttpError(
      500,
      "DB_ERROR",
      "Failed to resolve project membership role",
      error.message,
    );
  }

  return normalizeProjectRole(data?.role) ?? "user";
}

export async function getSessionUser(
  options: SessionOptions = {},
): Promise<SessionUser | null> {
  if (isE2EAuthBypassEnabled()) {
    return {
      userId: getE2EBypassUserId(),
      role: getE2EBypassRole(),
    };
  }

  try {
    const user = await requireUser();

    return {
      userId: user.userId,
      role: await resolveProjectRole(user.userId, options.projectId),
    };
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export async function requireSessionUser(
  nextPath: string,
  options: SessionOptions = {},
): Promise<SessionUser> {
  const sessionUser = await getSessionUser(options);

  if (!sessionUser) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  return sessionUser;
}

/**
 * @deprecated Local cookie-based sessions are no longer used at runtime.
 */
export async function getLastProjectId(): Promise<string | null> {
  return null;
}

/**
 * @deprecated Local cookie-based sessions are no longer used at runtime.
 */
export async function createLocalSession(input: {
  userId: string;
  role: ProjectRole;
  projectId: string;
}): Promise<void> {
  void input;
}

/**
 * @deprecated Local cookie-based sessions are no longer used at runtime.
 */
export async function clearLocalSession(): Promise<void> {
  return;
}
