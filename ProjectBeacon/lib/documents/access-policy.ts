import { normalizeProjectRole } from "@/lib/auth/project-role";
import type { SessionUser } from "@/lib/auth/clerk-auth";
import {
  getProjectMembership,
  resolveActorUserId,
} from "@/lib/projects/membership";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProjectDocumentRow = {
  id: string;
  project_id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by_user_id: string;
  is_public?: boolean | null;
  used_for_planning?: boolean | null;
  created_at: string;
};

type DocumentAccessResult = {
  actorUserId: string;
  role: "admin" | "user";
  document: ProjectDocumentRow;
  isAssigned: boolean;
  canView: boolean;
  canManage: boolean;
};

export async function listDocumentsForRole(params: {
  supabase: SupabaseClient;
  projectId: string;
  role: "admin" | "user";
  actorUserId: string;
}) {
  const { supabase, projectId, role, actorUserId } = params;
  const { data, error } = await supabase
    .from("project_documents")
    .select(
      "id,project_id,storage_key,file_name,mime_type,size_bytes,uploaded_by_user_id,is_public,used_for_planning,created_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  if (role === "admin") {
    return data;
  }

  const { data: accessRows, error: accessError } = await supabase
    .from("project_document_access")
    .select("document_id")
    .eq("user_id", actorUserId);

  if (accessError) {
    throw accessError;
  }

  const assignedDocumentIds = new Set(
    (accessRows ?? []).map((row) => row.document_id as string),
  );

  return (data ?? []).filter(
    (document) => document.is_public || assignedDocumentIds.has(document.id),
  );
}

export async function resolveDocumentAccess(params: {
  supabase: SupabaseClient;
  projectId: string;
  documentId: string;
  sessionUser: SessionUser;
}): Promise<DocumentAccessResult> {
  const { supabase, projectId, documentId, sessionUser } = params;

  const actorUserId = await resolveActorUserId(supabase, sessionUser);
  if (!actorUserId) {
    throw new Error("PROJECT_FORBIDDEN");
  }

  const membership = await getProjectMembership(
    supabase,
    projectId,
    actorUserId,
  );
  const normalizedRole = normalizeProjectRole(membership?.role);
  if (!normalizedRole) {
    throw new Error("PROJECT_FORBIDDEN");
  }

  const { data: document, error: documentError } = await supabase
    .from("project_documents")
    .select(
      "id,project_id,storage_key,file_name,mime_type,size_bytes,uploaded_by_user_id,is_public,used_for_planning,created_at",
    )
    .eq("project_id", projectId)
    .eq("id", documentId)
    .maybeSingle();

  if (documentError) {
    throw documentError;
  }

  if (!document) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  if (normalizedRole === "admin") {
    return {
      actorUserId,
      role: "admin",
      document,
      isAssigned: true,
      canView: true,
      canManage: true,
    };
  }

  const { data: accessRow, error: accessError } = await supabase
    .from("project_document_access")
    .select("id")
    .eq("document_id", documentId)
    .eq("user_id", actorUserId)
    .maybeSingle();

  if (accessError) {
    throw accessError;
  }

  const isAssigned = Boolean(accessRow);
  const canView = Boolean(document.is_public || isAssigned);

  return {
    actorUserId,
    role: "user",
    document,
    isAssigned,
    canView,
    canManage: false,
  };
}
