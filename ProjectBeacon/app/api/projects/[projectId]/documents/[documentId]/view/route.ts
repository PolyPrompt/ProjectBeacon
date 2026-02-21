import { requireSessionUser } from "@/lib/auth/clerk-auth";
import { apiError } from "@/lib/api/errors";
import { resolveDocumentAccess } from "@/lib/documents/access-policy";
import { createDocumentSignedUrl } from "@/lib/documents/supabase-signed-url";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

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

    const signedUrl = await createDocumentSignedUrl({
      storageKey: access.document.storage_key,
      expiresInSeconds: 120,
    });

    return Response.json(
      {
        documentId: access.document.id,
        fileName: access.document.file_name,
        mimeType: access.document.mime_type,
        signedUrl: signedUrl.url,
        expiresInSeconds: signedUrl.expiresInSeconds,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
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
      "Failed to create document preview URL.",
      500,
    );
  }
}
