import { HttpError, jsonError } from "@/lib/server/errors";

export type AuthUser = {
  userId: string;
};

const USER_HEADER_CANDIDATES = [
  "x-user-id",
  "x-projectbeacon-user-id",
  "x-clerk-user-id",
] as const;

export function getAuthUserFromRequest(request: Request): AuthUser | null {
  for (const header of USER_HEADER_CANDIDATES) {
    const value = request.headers.get(header);
    if (value && value.trim().length > 0) {
      return { userId: value.trim() };
    }
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer local-user:")) {
    const userId = authorization.replace("Bearer local-user:", "").trim();
    if (userId) {
      return { userId };
    }
  }

  return null;
}

export function requireAuthenticatedUserId(request: Request): string {
  const user = getAuthUserFromRequest(request);
  if (!user) {
    throw new HttpError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

  return user.userId;
}

export function requireAuthUser(
  request: Request,
):
  | { ok: true; user: AuthUser }
  | { ok: false; response: ReturnType<typeof jsonError> } {
  const user = getAuthUserFromRequest(request);
  if (!user) {
    return {
      ok: false,
      response: jsonError(401, "UNAUTHORIZED", "Authentication is required."),
    };
  }

  return { ok: true, user };
}
