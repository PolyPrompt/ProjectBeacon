import {
  isProjectAuthorizationError,
  projectForbiddenResponse,
  requireMinimumProjectRole,
  requireProjectMembership,
} from "@/lib/auth/project-role";
import { requireSessionUser } from "@/lib/auth/clerk-auth";
import { apiError } from "@/lib/api/errors";
import {
  getProjectMembership,
  resolveActorUserId,
} from "@/lib/projects/membership";
import { getProjectSettingsCapabilities } from "@/lib/projects/settings-policy";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateProjectSettingsSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    deadline: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((value) => value.name !== undefined || value.deadline !== undefined, {
    message: "At least one field must be provided.",
    path: ["name"],
  });

export async function GET(
  _: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const sessionUser = await requireSessionUser();
    const { projectId } = await params;
    const supabase = getServiceSupabaseClient();

    const actorUserId = await resolveActorUserId(supabase, sessionUser);
    if (!actorUserId) {
      return apiError(
        "PROJECT_FORBIDDEN",
        "You are not a member of this project.",
        403,
      );
    }

    const membership = await getProjectMembership(
      supabase,
      projectId,
      actorUserId,
    );
    const normalizedRole = requireProjectMembership(membership?.role);
    const capabilities = getProjectSettingsCapabilities(normalizedRole);

    return Response.json({
      projectId,
      role: normalizedRole,
      capabilities,
    });
  } catch (error) {
    if (isProjectAuthorizationError(error)) {
      return projectForbiddenResponse(error);
    }

    if (error instanceof z.ZodError) {
      return apiError("VALIDATION_ERROR", "Invalid request payload.", 400, {
        issues: error.issues,
      });
    }

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Failed to load project settings.",
      500,
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const sessionUser = await requireSessionUser();
    const { projectId } = await params;
    const payload = updateProjectSettingsSchema.parse(await request.json());
    const supabase = getServiceSupabaseClient();

    if (payload.deadline) {
      const deadlineDate = new Date(payload.deadline);
      if (deadlineDate.getTime() < Date.now()) {
        return apiError(
          "VALIDATION_ERROR",
          "Project deadline must be in the future.",
          400,
        );
      }
    }

    const actorUserId = await resolveActorUserId(supabase, sessionUser);
    if (!actorUserId) {
      return apiError(
        "PROJECT_FORBIDDEN",
        "You are not a member of this project.",
        403,
      );
    }

    const membership = await getProjectMembership(
      supabase,
      projectId,
      actorUserId,
    );
    requireMinimumProjectRole(membership?.role, "admin");

    const updates: {
      name?: string;
      deadline?: string;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (payload.name !== undefined) {
      updates.name = payload.name;
    }

    if (payload.deadline !== undefined) {
      updates.deadline = payload.deadline;
    }

    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", projectId)
      .select("id,name,description,deadline,owner_user_id,planning_status")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return apiError("NOT_FOUND", "Project not found.", 404);
    }

    return Response.json({
      id: data.id,
      name: data.name,
      description: data.description,
      deadline: data.deadline,
      ownerUserId: data.owner_user_id,
      planningStatus: data.planning_status,
    });
  } catch (error) {
    if (isProjectAuthorizationError(error)) {
      return projectForbiddenResponse(error);
    }

    if (error instanceof z.ZodError) {
      return apiError("VALIDATION_ERROR", "Invalid request payload.", 400, {
        issues: error.issues,
      });
    }

    return apiError("INTERNAL_SERVER_ERROR", "Failed to update project.", 500);
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const sessionUser = await requireSessionUser();
    const { projectId } = await params;
    const supabase = getServiceSupabaseClient();

    const actorUserId = await resolveActorUserId(supabase, sessionUser);
    if (!actorUserId) {
      return apiError(
        "PROJECT_FORBIDDEN",
        "You are not a member of this project.",
        403,
      );
    }

    const membership = await getProjectMembership(
      supabase,
      projectId,
      actorUserId,
    );
    requireMinimumProjectRole(membership?.role, "admin");

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);
    if (error) {
      return apiError(
        "PROJECT_DELETE_FAILED",
        "Could not delete project due to related records.",
        409,
      );
    }

    return Response.json({
      deleted: true,
      projectId,
    });
  } catch (error) {
    if (isProjectAuthorizationError(error)) {
      return projectForbiddenResponse(error);
    }

    return apiError("INTERNAL_SERVER_ERROR", "Failed to delete project.", 500);
  }
}
