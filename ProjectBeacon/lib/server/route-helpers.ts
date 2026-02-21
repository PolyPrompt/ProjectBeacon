import { z } from "zod";
import { requireAuthUser } from "@/lib/server/auth";
import { ApiHttpError, jsonError } from "@/lib/server/errors";
import {
  getProjectById,
  getProjectMembership,
  type ProjectMemberRow,
  type ProjectRow,
} from "@/lib/server/project-access";
import { SupabaseRequestError } from "@/lib/server/supabase-rest";

export async function requireProjectAccess(
  request: Request,
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
  const auth = requireAuthUser(request);
  if (!auth.ok) {
    return auth;
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return {
      ok: false,
      response: jsonError(404, "NOT_FOUND", "Project not found."),
    };
  }

  const membership = await getProjectMembership(projectId, auth.user.userId);
  if (!membership) {
    return {
      ok: false,
      response: jsonError(403, "FORBIDDEN", "Project membership is required."),
    };
  }

  return {
    ok: true,
    userId: auth.user.userId,
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
