import { NextResponse } from "next/server";

import type { ProjectRole, StoredProjectRole } from "@/types/roles";

type ProjectAuthorizationErrorCode =
  | "PROJECT_FORBIDDEN"
  | "PROJECT_ROLE_INSUFFICIENT";

const PROJECT_ROLE_RANK: Record<ProjectRole, number> = {
  user: 1,
  admin: 2,
};

export class ProjectAuthorizationError extends Error {
  readonly code: ProjectAuthorizationErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: ProjectAuthorizationErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.code = code;
    this.status = 403;
    this.details = details;
  }
}

export function normalizeProjectRole(
  role: string | null | undefined,
): ProjectRole | null {
  if (!role) {
    return null;
  }

  if (role === "admin" || role === "owner") {
    return "admin";
  }

  if (role === "user" || role === "member") {
    return "user";
  }

  return null;
}

export function toStoredProjectRole(
  role: ProjectRole,
  options?: { preferLegacy?: boolean },
): StoredProjectRole {
  if (options?.preferLegacy === false) {
    return role;
  }

  return role === "admin" ? "owner" : "member";
}

export function hasMinimumProjectRole(
  role: string | null | undefined,
  minimumRole: ProjectRole,
): boolean {
  const normalizedRole = normalizeProjectRole(role);

  if (!normalizedRole) {
    return false;
  }

  return PROJECT_ROLE_RANK[normalizedRole] >= PROJECT_ROLE_RANK[minimumRole];
}

export function requireProjectMembership(
  role: string | null | undefined,
): ProjectRole {
  const normalizedRole = normalizeProjectRole(role);

  if (!normalizedRole) {
    throw new ProjectAuthorizationError(
      "PROJECT_FORBIDDEN",
      "You are not a member of this project.",
    );
  }

  return normalizedRole;
}

export function requireMinimumProjectRole(
  role: string | null | undefined,
  minimumRole: ProjectRole,
): ProjectRole {
  const normalizedRole = requireProjectMembership(role);

  if (!hasMinimumProjectRole(normalizedRole, minimumRole)) {
    throw new ProjectAuthorizationError(
      "PROJECT_ROLE_INSUFFICIENT",
      "You do not have permission to perform this action.",
      {
        minimumRole,
        currentRole: normalizedRole,
      },
    );
  }

  return normalizedRole;
}

export function isProjectAuthorizationError(
  error: unknown,
): error is ProjectAuthorizationError {
  return error instanceof ProjectAuthorizationError;
}

export function projectForbiddenResponse(
  error: ProjectAuthorizationError,
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      },
    },
    { status: error.status },
  );
}
