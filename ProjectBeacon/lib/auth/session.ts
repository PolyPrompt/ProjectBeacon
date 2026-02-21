import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type ProjectRole = "admin" | "user";

export type SessionUser = {
  userId: string;
  role: ProjectRole;
};

const USER_ID_COOKIE = "pb_user_id";
const ROLE_COOKIE = "pb_role";
const LAST_PROJECT_COOKIE = "pb_last_project_id";

function normalizeRole(value: string | undefined): ProjectRole {
  return value === "admin" ? "admin" : "user";
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_ID_COOKIE)?.value;

  if (!userId) {
    return null;
  }

  return {
    userId,
    role: normalizeRole(cookieStore.get(ROLE_COOKIE)?.value),
  };
}

export async function requireSessionUser(
  nextPath: string,
): Promise<SessionUser> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  return sessionUser;
}

export async function getLastProjectId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(LAST_PROJECT_COOKIE)?.value ?? null;
}

export async function createLocalSession(input: {
  userId: string;
  role: ProjectRole;
  projectId: string;
}): Promise<void> {
  const cookieStore = await cookies();
  const baseCookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };

  cookieStore.set(USER_ID_COOKIE, input.userId, baseCookie);
  cookieStore.set(ROLE_COOKIE, input.role, baseCookie);
  cookieStore.set(LAST_PROJECT_COOKIE, input.projectId, baseCookie);
}

export async function clearLocalSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(USER_ID_COOKIE);
  cookieStore.delete(ROLE_COOKIE);
}
