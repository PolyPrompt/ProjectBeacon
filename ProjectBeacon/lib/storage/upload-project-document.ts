import { ApiHttpError } from "@/lib/api/errors";
import { getEnv } from "@/lib/env";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export type ProjectDocumentDTO = {
  id: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedByUserId: string;
  createdAt: string;
};

export async function uploadProjectDocument(input: {
  projectId: string;
  uploadedByUserId: string;
  file: File;
}): Promise<ProjectDocumentDTO> {
  const { projectId, uploadedByUserId, file } = input;

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new ApiHttpError(
      400,
      "UNSUPPORTED_FILE_TYPE",
      `Unsupported file type: ${file.type || "unknown"}`,
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new ApiHttpError(
      400,
      "FILE_TOO_LARGE",
      `File exceeds ${MAX_FILE_BYTES} bytes`,
    );
  }

  const env = getEnv();
  const supabase = getServiceSupabaseClient();
  const documentId = crypto.randomUUID();
  const safeName = sanitizeFileName(file.name);
  const storageKey = `projects/${projectId}/docs/${documentId}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(storageKey, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new ApiHttpError(
      500,
      "STORAGE_ERROR",
      "Failed uploading file to storage",
      uploadError.message,
    );
  }

  const { data: document, error: documentError } = await supabase
    .from("project_documents")
    .insert({
      id: documentId,
      project_id: projectId,
      storage_key: storageKey,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by_user_id: uploadedByUserId,
    })
    .select("*")
    .single();

  if (documentError) {
    throw new ApiHttpError(
      500,
      "DB_ERROR",
      "Failed saving document metadata",
      documentError.message,
    );
  }

  return {
    id: document.id,
    projectId: document.project_id,
    fileName: document.file_name,
    mimeType: document.mime_type,
    sizeBytes: document.size_bytes,
    storageKey: document.storage_key,
    uploadedByUserId: document.uploaded_by_user_id,
    createdAt: document.created_at,
  };
}
