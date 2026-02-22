import { normalizeProjectRole } from "@/lib/auth/project-role";
import { requireSessionUser } from "@/lib/auth/clerk-auth";
import { ApiHttpError, apiError } from "@/lib/api/errors";
import {
  PROJECT_DOCUMENT_ALLOWED_TYPES_LABEL,
  isAllowedProjectDocumentExtension,
  isAllowedProjectDocumentMimeType,
} from "@/lib/documents/file-types";
import { listDocumentsForRole } from "@/lib/documents/access-policy";
import {
  getProjectMembership,
  resolveActorUserId,
} from "@/lib/projects/membership";
import { uploadProjectDocument } from "@/lib/storage/upload-project-document";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const uploadDocumentSchema = z.object({
  fileName: z.string().trim().min(1).refine(isAllowedProjectDocumentExtension, {
    message: `fileName must end with .pdf, .docx, or .txt.`,
  }),
  mimeType: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toLowerCase())
    .refine(isAllowedProjectDocumentMimeType, {
      message: `mimeType must be one of the allowed project document types (${PROJECT_DOCUMENT_ALLOWED_TYPES_LABEL}).`,
    }),
  sizeBytes: z.number().int().nonnegative(),
  storageKey: z.string().trim().min(1),
  isPublic: z.boolean().optional().default(false),
  usedForPlanning: z.boolean().optional().default(false),
});

const deleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

function toBooleanField(value: FormDataEntryValue | null): boolean {
  return typeof value === "string" && value.toLowerCase() === "true";
}

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
        isPublic: Boolean(document.is_public),
        usedForPlanning: Boolean(document.used_for_planning),
        // Do not expose storage keys to non-admin roles.
        ...(role === "admin" ? { storageKey: document.storage_key } : {}),
        createdAt: document.created_at,
      })),
      role,
    });
  } catch (error) {
    if (error instanceof ApiHttpError) {
      return apiError(error.code, error.message, error.status, error.details);
    }

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

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return apiError(
          "VALIDATION_ERROR",
          "Expected multipart form field `file`",
          400,
        );
      }

      const uploaded = await uploadProjectDocument({
        projectId,
        uploadedByUserId: actorUserId,
        file,
      });

      const isPublic = toBooleanField(formData.get("isPublic"));
      const usedForPlanning = toBooleanField(formData.get("usedForPlanning"));

      if (isPublic || usedForPlanning) {
        const { error: updateError } = await supabase
          .from("project_documents")
          .update({
            is_public: isPublic,
            used_for_planning: usedForPlanning,
          })
          .eq("id", uploaded.id)
          .eq("project_id", projectId);

        if (updateError) {
          throw updateError;
        }
      }

      return Response.json(
        {
          document: {
            id: uploaded.id,
            projectId: uploaded.projectId,
            fileName: uploaded.fileName,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
            storageKey: uploaded.storageKey,
            createdAt: uploaded.createdAt,
            isPublic,
            usedForPlanning,
          },
        },
        { status: 201 },
      );
    }

    const payload = uploadDocumentSchema.parse(await request.json());

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
        "id,project_id,storage_key,file_name,mime_type,size_bytes,uploaded_by_user_id,is_public,used_for_planning,created_at",
      )
      .maybeSingle();

    if (documentError || !document) {
      throw documentError ?? new Error("Could not create project document.");
    }

    return Response.json(
      {
        document: {
          id: document.id,
          projectId: document.project_id,
          fileName: document.file_name,
          mimeType: document.mime_type,
          sizeBytes: document.size_bytes,
          storageKey: document.storage_key,
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

    if (error instanceof ApiHttpError) {
      return apiError(error.code, error.message, error.status, error.details);
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

    if (error instanceof ApiHttpError) {
      return apiError(error.code, error.message, error.status, error.details);
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
