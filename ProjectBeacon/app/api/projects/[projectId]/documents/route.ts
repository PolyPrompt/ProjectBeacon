import { normalizeProjectRole } from "@/lib/auth/project-role";
import { requireSessionUser } from "@/lib/auth/clerk-auth";
import { apiError } from "@/lib/api/errors";
import { listDocumentsForRole } from "@/lib/documents/access-policy";
import {
  getProjectMembership,
  resolveActorUserId,
} from "@/lib/projects/membership";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const uploadDocumentSchema = z.object({
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().nonnegative(),
  storageKey: z.string().trim().min(1),
  isPublic: z.boolean().optional().default(false),
  usedForPlanning: z.boolean().optional().default(false),
  assignedUserIds: z.array(z.string().uuid()).optional().default([]),
});

const deleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
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
    const role = normalizeProjectRole(membership?.role);
    if (!role) {
      return apiError(
        "PROJECT_FORBIDDEN",
        "You are not a member of this project.",
        403,
      );
    }

    const documents = await listDocumentsForRole({
      supabase,
      projectId,
      role,
      actorUserId,
    });

    return Response.json({
      documents: (documents ?? []).map((document) => ({
        id: document.id,
        projectId: document.project_id,
        fileName: document.file_name,
        mimeType: document.mime_type,
        sizeBytes: document.size_bytes,
        uploadedByUserId: document.uploaded_by_user_id,
        isPublic: Boolean(document.is_public),
        usedForPlanning: Boolean(document.used_for_planning),
        createdAt: document.created_at,
      })),
      role,
    });
  } catch (error) {
    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Failed to load project documents.",
      500,
      {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const sessionUser = await requireSessionUser();
    const payload = uploadDocumentSchema.parse(await request.json());
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
    const role = normalizeProjectRole(membership?.role);

    if (role !== "admin") {
      return apiError(
        "PROJECT_ROLE_INSUFFICIENT",
        "You do not have permission to upload documents.",
        403,
      );
    }

    const { data: document, error: documentError } = await supabase
      .from("project_documents")
      .insert({
        project_id: projectId,
        storage_key: payload.storageKey,
        file_name: payload.fileName,
        mime_type: payload.mimeType,
        size_bytes: payload.sizeBytes,
        uploaded_by_user_id: actorUserId,
        is_public: payload.isPublic,
        used_for_planning: payload.usedForPlanning,
      })
      .select(
        "id,project_id,file_name,mime_type,size_bytes,uploaded_by_user_id,is_public,used_for_planning,created_at",
      )
      .maybeSingle();

    if (documentError || !document) {
      throw documentError ?? new Error("Could not create project document.");
    }

    if (payload.assignedUserIds.length > 0) {
      const assignmentRows = payload.assignedUserIds.map((userId) => ({
        document_id: document.id,
        user_id: userId,
        assigned_by_user_id: actorUserId,
      }));

      const { error: assignmentError } = await supabase
        .from("project_document_access")
        .upsert(assignmentRows, { onConflict: "document_id,user_id" });

      if (assignmentError) {
        throw assignmentError;
      }
    }

    return Response.json(
      {
        document: {
          id: document.id,
          projectId: document.project_id,
          fileName: document.file_name,
          mimeType: document.mime_type,
          sizeBytes: document.size_bytes,
          uploadedByUserId: document.uploaded_by_user_id,
          isPublic: Boolean(document.is_public),
          usedForPlanning: Boolean(document.used_for_planning),
          createdAt: document.created_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("VALIDATION_ERROR", "Invalid request payload.", 400, {
        issues: error.issues,
      });
    }

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Failed to upload document.",
      500,
      {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const sessionUser = await requireSessionUser();
    const { documentId } = deleteDocumentSchema.parse(await request.json());
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
    const role = normalizeProjectRole(membership?.role);
    if (role !== "admin") {
      return apiError(
        "PROJECT_ROLE_INSUFFICIENT",
        "You do not have permission to delete documents.",
        403,
      );
    }

    const { error: accessDeleteError } = await supabase
      .from("project_document_access")
      .delete()
      .eq("document_id", documentId);

    if (accessDeleteError) {
      throw accessDeleteError;
    }

    const { error: documentDeleteError } = await supabase
      .from("project_documents")
      .delete()
      .eq("id", documentId)
      .eq("project_id", projectId);

    if (documentDeleteError) {
      throw documentDeleteError;
    }

    return Response.json({
      deleted: true,
      documentId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError("VALIDATION_ERROR", "Invalid request payload.", 400, {
        issues: error.issues,
      });
    }

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Failed to delete document.",
      500,
      {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    );
  }
}
