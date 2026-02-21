import { normalizeProjectRole } from "@/lib/auth/project-role";
import { requireSessionUser } from "@/lib/auth/clerk-auth";
import { apiError } from "@/lib/api/errors";
import { listDocumentsForRole } from "@/lib/documents/access-policy";
import {
  getProjectMembership,
  resolveActorUserId,
} from "@/lib/projects/membership";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

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

    const visibleDocuments = await listDocumentsForRole({
      supabase,
      projectId,
      role,
      actorUserId,
    });

    return Response.json({
      documents: (visibleDocuments ?? [])
        .filter((document) => Boolean(document.used_for_planning))
        .map((document) => ({
          id: document.id,
          projectId: document.project_id,
          fileName: document.file_name,
          mimeType: document.mime_type,
          sizeBytes: document.size_bytes,
          createdAt: document.created_at,
        })),
    });
  } catch (error) {
    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Failed to load planning documents.",
      500,
      {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    );
  }
}
