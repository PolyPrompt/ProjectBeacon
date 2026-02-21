"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal";
import type { DocumentsListDTO, ProjectDocumentDTO } from "@/types/documents";

type ProjectDocumentsPageProps = {
  projectId: string;
  role: "admin" | "user";
};

const FALLBACK_DOCUMENTS: ProjectDocumentDTO[] = [
  {
    id: "doc_scaffold_1",
    fileName: "requirements-summary.pdf",
    mimeType: "application/pdf",
    sizeBytes: 382_000,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

function parseDocuments(value: unknown): ProjectDocumentDTO[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const payload = value as DocumentsListDTO & {
    projectDocuments?: ProjectDocumentDTO[];
  };

  const candidateList = payload.documents ?? payload.projectDocuments ?? [];
  if (!Array.isArray(candidateList)) {
    return [];
  }

  return candidateList
    .map((doc) => {
      if (
        !doc ||
        typeof doc.id !== "string" ||
        typeof doc.fileName !== "string" ||
        typeof doc.mimeType !== "string" ||
        typeof doc.sizeBytes !== "number" ||
        typeof doc.createdAt !== "string"
      ) {
        return null;
      }

      return {
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        createdAt: doc.createdAt,
      };
    })
    .filter((doc): doc is ProjectDocumentDTO => Boolean(doc));
}

function toReadableSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectDocumentsPage({
  projectId,
  role,
}: ProjectDocumentsPageProps) {
  const [documents, setDocuments] = useState<ProjectDocumentDTO[]>([]);
  const [planningDocuments, setPlanningDocuments] = useState<
    ProjectDocumentDTO[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] =
    useState<ProjectDocumentDTO | null>(null);
  const [assignUserId, setAssignUserId] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  const isAdmin = role === "admin";

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [documentsResponse, planningResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}/documents`, {
          method: "GET",
          cache: "no-store",
        }),
        fetch(`/api/projects/${projectId}/documents/used-in-planning`, {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      if (!documentsResponse.ok || !planningResponse.ok) {
        throw new Error(
          `Documents endpoints returned ${documentsResponse.status}/${planningResponse.status}`,
        );
      }

      const documentsJson = (await documentsResponse.json()) as unknown;
      const planningJson = (await planningResponse.json()) as unknown;

      const loadedDocuments = parseDocuments(documentsJson);
      const loadedPlanningDocuments = parseDocuments(planningJson);

      setDocuments(loadedDocuments);
      setPlanningDocuments(loadedPlanningDocuments);
    } catch (loadError) {
      setDocuments(FALLBACK_DOCUMENTS);
      setPlanningDocuments(FALLBACK_DOCUMENTS);
      setError(
        loadError instanceof Error
          ? `${loadError.message}. Showing scaffold documents.`
          : "Failed to load documents. Showing scaffold documents.",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function handleUpload(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      setActionStatus("Select a file first.");
      return;
    }

    try {
      setUploading(true);
      setActionStatus(null);

      const uploadFormData = new FormData();
      uploadFormData.set("file", file);

      const response = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with ${response.status}`);
      }

      setActionStatus("Upload complete.");
      await loadDocuments();
    } catch (uploadError) {
      setActionStatus(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload failed due to an unknown error.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleAssign(documentId: string) {
    const userId = assignUserId[documentId]?.trim();
    if (!userId) {
      setActionStatus("Enter a user ID before assigning access.");
      return;
    }

    try {
      setActionStatus(null);
      const response = await fetch(
        `/api/projects/${projectId}/documents/${documentId}/access`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        },
      );

      if (!response.ok) {
        throw new Error(`Assign access failed with ${response.status}`);
      }

      setActionStatus(`Assigned ${documentId} to ${userId}.`);
    } catch (assignError) {
      setActionStatus(
        assignError instanceof Error
          ? assignError.message
          : "Failed to assign access.",
      );
    }
  }

  async function handleRemove(documentId: string) {
    try {
      setActionStatus(null);
      const response = await fetch(
        `/api/projects/${projectId}/documents/${documentId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(`Remove failed with ${response.status}`);
      }

      setActionStatus(`Removed ${documentId}.`);
      await loadDocuments();
    } catch (removeError) {
      setActionStatus(
        removeError instanceof Error
          ? removeError.message
          : "Failed to remove document.",
      );
    }
  }

  const planningDocumentIds = useMemo(
    () => new Set(planningDocuments.map((document) => document.id)),
    [planningDocuments],
  );

  return (
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
        <p className="mt-1 text-sm text-slate-600">
          {isAdmin
            ? "Manage uploads, sharing, and planning source documents."
            : "Read-only access: you can preview and download assigned documents."}
        </p>
        {!isAdmin ? (
          <span className="mt-3 inline-flex rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold uppercase text-slate-700">
            Read-only user mode
          </span>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      {isAdmin ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Admin Controls
          </h2>
          <form
            action={handleUpload}
            className="mt-3 flex flex-wrap items-center gap-3"
          >
            <input
              accept=".pdf,.doc,.docx,.txt,image/*"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              name="file"
              type="file"
            />
            <button
              className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-70"
              disabled={uploading}
              type="submit"
            >
              {uploading ? "Uploading..." : "Upload document"}
            </button>
          </form>
        </section>
      ) : null}

      {actionStatus ? (
        <p className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800">
          {actionStatus}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Project Documents
        </h2>

        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading documents...</p>
        ) : documents.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            No documents available.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {documents.map((document) => (
              <li
                key={document.id}
                className="rounded-xl border border-slate-200 p-3 transition-colors hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    className="text-left"
                    onClick={() => setSelectedDocument(document)}
                    type="button"
                  >
                    <p className="font-medium text-slate-900">
                      {document.fileName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {toReadableSize(document.sizeBytes)} · {document.mimeType}{" "}
                      · {new Date(document.createdAt).toLocaleString()}
                    </p>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    {planningDocumentIds.has(document.id) ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                        Used for planning
                      </span>
                    ) : null}
                    <button
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      onClick={() => setSelectedDocument(document)}
                      type="button"
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {isAdmin ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
                      onChange={(event) =>
                        setAssignUserId((current) => ({
                          ...current,
                          [document.id]: event.target.value,
                        }))
                      }
                      placeholder="User ID to assign"
                      value={assignUserId[document.id] ?? ""}
                    />
                    <button
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      onClick={() => void handleAssign(document.id)}
                      type="button"
                    >
                      Assign
                    </button>
                    <button
                      className="rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      onClick={() => void handleRemove(document.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Used to Generate Tasks
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">
            Loading generation-source documents...
          </p>
        ) : planningDocuments.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            No generation-source documents recorded yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-800">
            {planningDocuments.map((document) => (
              <li
                key={`planning-${document.id}`}
                className="rounded-lg bg-slate-100 px-3 py-2"
              >
                {document.fileName}
              </li>
            ))}
          </ul>
        )}
      </section>

      <DocumentPreviewModal
        document={selectedDocument}
        onClose={() => setSelectedDocument(null)}
        projectId={projectId}
      />
    </section>
  );
}
