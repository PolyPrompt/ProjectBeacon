import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requireProjectMember } from "@/lib/projects/membership";
import { uploadProjectDocument } from "@/lib/storage/upload-project-document";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  projectId: z.uuid(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser();
    const params = paramsSchema.parse(await context.params);

    await requireProjectMember(params.projectId, user.userId);

    const supabase = getServiceSupabaseClient();

    const { data, error } = await supabase
      .from("project_documents")
      .select("*")
      .eq("project_id", params.projectId)
      .order("created_at", { ascending: false });

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading project documents",
        error.message,
      );
    }

    return NextResponse.json(
      {
        documents: data.map((document) => ({
          id: document.id,
          projectId: document.project_id,
          fileName: document.file_name,
          mimeType: document.mime_type,
          sizeBytes: document.size_bytes,
          storageKey: document.storage_key,
          uploadedByUserId: document.uploaded_by_user_id,
          createdAt: document.created_at,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser();
    const params = paramsSchema.parse(await context.params);

    await requireProjectMember(params.projectId, user.userId);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Expected multipart form field `file`",
      );
    }

    const document = await uploadProjectDocument({
      projectId: params.projectId,
      uploadedByUserId: user.userId,
      file,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
