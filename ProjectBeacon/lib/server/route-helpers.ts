import { z } from "zod";
import { requireSessionUser } from "@/lib/auth/clerk-auth";
import { ApiHttpError, jsonError } from "@/lib/server/errors";
import {
  getProjectById,
  getProjectMembership,
  normalizeProjectRole,
  type ProjectMemberRow,
  type ProjectRow,
} from "@/lib/server/project-access";
import { SupabaseRequestError, selectSingle } from "@/lib/server/supabase-rest";

type UserIdRow = {
  id: string;
};

async function resolveActorUserIdFromSession(): Promise<string | null> {
  const sessionUser = await requireSessionUser();

  if (sessionUser.localUserId) {
    return sessionUser.localUserId;
  }

  const userByClerkId = await selectSingle<UserIdRow>("users", {
    select: "id",
    clerk_user_id: `eq.${sessionUser.clerkUserId}`,
  });
  if (userByClerkId) {
    return userByClerkId.id;
  }

  if (!sessionUser.email) {
    return null;
  }

  const userByEmail = await selectSingle<UserIdRow>("users", {
    select: "id",
    email: `eq.${sessionUser.email}`,
  });

  return userByEmail?.id ?? null;
}

export async function requireProjectAccess(
  _request: Request,
  projectId: string,
): Promise<
  | {
      ok: true;
      userId: string;
      membership: ProjectMemberRow;
      project: ProjectRow;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  let actorUserId: string | null;
  try {
    actorUserId = await resolveActorUserIdFromSession();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return {
        ok: false,
        response: jsonError(401, "UNAUTHORIZED", "Authentication is required."),
      };
    }

    throw error;
  }

  if (!actorUserId) {
    return {
      ok: false,
      response: jsonError(403, "FORBIDDEN", "Project membership is required."),
    };
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return {
      ok: false,
      response: jsonError(404, "NOT_FOUND", "Project not found."),
    };
  }

  const membership = await getProjectMembership(projectId, actorUserId);
  if (!membership) {
    return {
      ok: false,
      response: jsonError(403, "FORBIDDEN", "Project membership is required."),
    };
  }

  return {
    ok: true,
    userId: actorUserId,
    membership,
    project,
  };
}

export function requireOwner(membership: ProjectMemberRow): Response | null {
  if (membership.role !== "owner") {
    return jsonError(
      403,
      "FORBIDDEN",
      "Only the project owner can perform this action.",
    );
  }

  return null;
}

export function requireProjectAdmin(
  membership: ProjectMemberRow,
): Response | null {
  if (normalizeProjectRole(membership.role) !== "admin") {
    return jsonError(
      403,
      "FORBIDDEN",
      "Only project admins can perform this action.",
    );
  }

  return null;
}

export function parseBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): { ok: true; data: T } | { ok: false; response: Response } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError(
        400,
        "VALIDATION_ERROR",
        "Invalid request body.",
        parsed.error.flatten(),
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

export function mapRouteError(error: unknown): Response {
  if (error instanceof ApiHttpError) {
    return jsonError(error.status, error.code, error.message, error.details);
  }

  if (error instanceof SupabaseRequestError) {
    return jsonError(500, "DATABASE_ERROR", "Database operation failed.", {
      status: error.status,
      details: error.details,
    });
  }

  if (error instanceof Error) {
    return jsonError(500, "INTERNAL_ERROR", error.message);
  }

  return jsonError(500, "INTERNAL_ERROR", "Unknown server error.");
}
