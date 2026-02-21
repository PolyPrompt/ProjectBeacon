import { normalizeProjectRole } from "@/lib/auth/project-role";
import { requireSessionUser } from "@/lib/auth/clerk-auth";
import { apiError } from "@/lib/api/errors";
import { resolveDocumentAccess } from "@/lib/documents/access-policy";
import {
  getProjectMembership,
  resolveActorUserId,
} from "@/lib/projects/membership";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const updateDocumentAccessSchema = z.object({
  isPublic: z.boolean().optional(),
  assignedUserIds: z.array(z.string().uuid()).optional().default([]),
});

export async function GET(
  _: Request,
  { params }: { params: Promise<{ projectId: string; documentId: string }> },
) {
  try {
    const sessionUser = await requireSessionUser();
    const { projectId, documentId } = await params;
    const supabase = getServiceSupabaseClient();

    const access = await resolveDocumentAccess({
      supabase,
      projectId,
      documentId,
      sessionUser,
    });

    if (!access.canView) {
      return apiError(
        "PROJECT_FORBIDDEN",
        "You cannot access this document.",
        403,
      );
    }

    const { data: assignedRows, error: assignedError } = await supabase
      .from("project_document_access")
      .select("user_id")
      .eq("document_id", documentId);

    if (assignedError) {
      throw assignedError;
    }

    return Response.json({
      documentId,
      isPublic: Boolean(access.document.is_public),
      assignedUserIds: (assignedRows ?? []).map((row) => row.user_id as string),
      canManage: access.canManage,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DOCUMENT_NOT_FOUND") {
      return apiError("NOT_FOUND", "Document not found.", 404);
    }

    if (error instanceof Error && error.message === "PROJECT_FORBIDDEN") {
      return apiError(
        "PROJECT_FORBIDDEN",
        "You cannot access this document.",
        403,
      );
    }

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Failed to load document access.",
      500,
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; documentId: string }> },
) {
  try {
    const sessionUser = await requireSessionUser();
    const payload = updateDocumentAccessSchema.parse(await request.json());
    const { projectId, documentId } = await params;
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
    const role = normalizeProjectRole(membership?.role);
    if (role !== "admin") {
      return apiError(
        "PROJECT_ROLE_INSUFFICIENT",
        "You do not have permission to manage document access.",
        403,
      );
    }

    if (payload.isPublic !== undefined) {
      const { error: visibilityError } = await supabase
        .from("project_documents")
        .update({ is_public: payload.isPublic })
        .eq("id", documentId)
        .eq("project_id", projectId);

      if (visibilityError) {
        throw visibilityError;
      }
    }

    const { error: resetError } = await supabase
      .from("project_document_access")
      .delete()
      .eq("document_id", documentId);

    if (resetError) {
      throw resetError;
    }

    if (payload.assignedUserIds.length > 0) {
      const rows = payload.assignedUserIds.map((userId) => ({
        document_id: documentId,
        user_id: userId,
        assigned_by_user_id: actorUserId,
      }));

      const { error: insertError } = await supabase
        .from("project_document_access")
        .insert(rows);

      if (insertError) {
        throw insertError;
      }
    }

    return Response.json({
      updated: true,
      documentId,
      isPublic: payload.isPublic ?? null,
      assignedUserIds: payload.assignedUserIds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("VALIDATION_ERROR", "Invalid request payload.", 400, {
        issues: error.issues,
      });
    }

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Failed to update document access.",
      500,
    );
  }
}
