"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocumentPreviewModal } from "@/components/documents/document-preview-modal";
import {
  PROJECT_DOCUMENT_ACCEPT_ATTR,
  PROJECT_DOCUMENT_ALLOWED_TYPES_LABEL,
  isPermittedProjectDocumentFile,
} from "@/lib/documents/file-types";
import type { DocumentsListDTO, ProjectDocumentDTO } from "@/types/documents";

type ProjectDocumentsPageProps = {
  projectId: string;
  role: "admin" | "user";
};

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

function describeUploadTime(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return "Recently";
  }

  const elapsedMs = Date.now() - parsed.getTime();
  const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / 60_000));

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

async function resolveApiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? fallback;
  } catch {
    return fallback;
  }
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
  const [uploading, setUploading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [pastedSpecs, setPastedSpecs] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = role === "admin";

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const documentsResponse = await fetch(
        `/api/projects/${projectId}/documents`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!documentsResponse.ok) {
        const message = await resolveApiErrorMessage(
          documentsResponse,
          "Failed to load project documents.",
        );
        throw new Error(message);
      }

      const documentsJson = (await documentsResponse.json()) as unknown;
      const loadedDocuments = parseDocuments(documentsJson);
      setDocuments(loadedDocuments);

      const planningResponse = await fetch(
        `/api/projects/${projectId}/documents/used-in-planning`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!planningResponse.ok) {
        const message = await resolveApiErrorMessage(
          planningResponse,
          "Failed to load planning-source documents.",
        );
        setPlanningDocuments([]);
        setError(message);
        return;
      }

      const planningJson = (await planningResponse.json()) as unknown;
      setPlanningDocuments(parseDocuments(planningJson));
    } catch (loadError) {
      setDocuments([]);
      setPlanningDocuments([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load documents.",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function uploadDocument(
    file: File | null | undefined,
    options?: {
      usedForPlanning?: boolean;
      successMessage?: string;
    },
  ): Promise<boolean> {
    if (!(file instanceof File)) {
      setActionStatus("Select a file first.");
      return false;
    }

    if (!isAdmin) {
      setActionStatus("Only admins can upload project documents.");
      return false;
    }

    if (
      !isPermittedProjectDocumentFile({
        fileName: file.name,
        mimeType: file.type,
      })
    ) {
      setActionStatus(
        `Unsupported file type. Allowed types: ${PROJECT_DOCUMENT_ALLOWED_TYPES_LABEL}.`,
      );
      return false;
    }

    try {
      setUploading(true);
      setActionStatus(null);

      const uploadFormData = new FormData();
      uploadFormData.set("file", file);
      if (options?.usedForPlanning) {
        uploadFormData.set("usedForPlanning", "true");
      }

      const response = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        const message = await resolveApiErrorMessage(
          response,
          `Upload failed with ${response.status}`,
        );
        throw new Error(message);
      }

      setActionStatus(options?.successMessage ?? "Upload complete.");
      await loadDocuments();
      return true;
    } catch (uploadError) {
      setActionStatus(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload failed due to an unknown error.",
      );
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function handleSavePastedSpecs() {
    const trimmedSpecs = pastedSpecs.trim();
    if (!trimmedSpecs) {
      setActionStatus("Enter text in Paste Specifications before saving.");
      return;
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:]/g, "-")
      .replace(/[.]/g, "_");
    const fileName = `pasted-specifications-${timestamp}.txt`;
    const file = new File([trimmedSpecs], fileName, {
      type: "text/plain",
    });

    const uploaded = await uploadDocument(file, {
      usedForPlanning: true,
      successMessage: "Specifications saved to project documents.",
    });

    if (uploaded) {
      setPastedSpecs("");
    }
  }

  async function handleRemove(documentId: string) {
    try {
      setActionStatus(null);
      const response = await fetch(`/api/projects/${projectId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });

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

  const recentDocuments = useMemo(
    () =>
      [...documents].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [documents],
  );

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-100">
          Upload Project Specs
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-slate-400">
          Save your project requirements here!
        </p>
        {!isAdmin ? (
          <span className="inline-flex rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-100">
            Read-only user mode
          </span>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      ) : null}

      {actionStatus ? (
        <p className="rounded-xl border border-slate-700 bg-[#11131d] px-3 py-2 text-sm text-slate-200">
          {actionStatus}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:auto-rows-[minmax(180px,auto)]">
        <section
          className={`relative overflow-hidden rounded-2xl border bg-[#171821] p-6 md:col-span-8 md:row-span-2 ${
            isDragActive
              ? "border-violet-500/70 ring-2 ring-violet-500/40"
              : "border-[#2d2638]"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            if (isAdmin && !uploading) {
              setIsDragActive(true);
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (isAdmin && !uploading) {
              setIsDragActive(true);
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragActive(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragActive(false);
            const file = event.dataTransfer.files?.[0];
            void uploadDocument(file);
          }}
        >
          <div className="pointer-events-none absolute inset-4 rounded-xl border-2 border-dashed border-slate-800" />
          <div className="relative z-10 flex min-h-[17rem] flex-col items-center justify-center gap-5 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-sm font-semibold text-violet-200">
              UP
            </div>
            <div className="space-y-2">
              <h2 className="text-4xl font-bold tracking-tight text-slate-100">
                Drag and drop files
              </h2>
              <p className="text-base text-slate-400">
                PDF, DOCX, or TXT formats supported (Max 50MB)
              </p>
            </div>
            <input
              ref={fileInputRef}
              accept={PROJECT_DOCUMENT_ACCEPT_ATTR}
              className="hidden"
              name="file"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                void uploadDocument(file);
                event.target.value = "";
              }}
            />
            <button
              className="rounded-lg bg-violet-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!isAdmin || uploading}
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "Uploading..." : "Browse Files"}
            </button>
            {!isAdmin ? (
              <p className="text-xs text-slate-500">
                Only project admins can upload files.
              </p>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-[#2d2638] bg-[#171821] p-5 md:col-span-4 md:row-span-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold uppercase tracking-wide">
              Paste Specifications
            </span>
            <button
              className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-violet-900/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                !isAdmin || uploading || pastedSpecs.trim().length === 0
              }
              type="button"
              onClick={() => {
                void handleSavePastedSpecs();
              }}
            >
              Save
            </button>
          </div>
          <textarea
            className="min-h-[16rem] flex-1 resize-none rounded-lg border border-[#2d2638] bg-[#0f1118] p-4 text-sm leading-relaxed text-slate-300 placeholder:text-slate-600 focus:border-violet-400 focus:outline-none"
            onChange={(event) => setPastedSpecs(event.target.value)}
            placeholder="Or paste your project specifications directly here... If you have a raw list of requirements or a brief, the AI can parse it from here."
            value={pastedSpecs}
          />
          {!isAdmin ? (
            <p className="text-xs text-slate-500">
              Only project admins can save pasted specs.
            </p>
          ) : null}
          <p className="text-xs text-slate-500">
            {planningDocuments.length} document
            {planningDocuments.length === 1 ? "" : "s"} currently used for task
            generation.
          </p>
          {planningDocuments.length > 0 ? (
            <ul className="space-y-2">
              {planningDocuments.slice(0, 3).map((document) => (
                <li
                  key={`planning-${document.id}`}
                  className="rounded-lg border border-slate-700 bg-[#0f1118] px-3 py-2 text-xs text-slate-300"
                >
                  {document.fileName}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[#2d2638] bg-[#171821] p-5 md:col-span-8 md:row-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100">
              Recent Uploads
            </h3>
            <button
              className="text-xs font-medium text-violet-300 hover:text-violet-200"
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              View All
            </button>
          </div>

          {loading ? (
            <p className="rounded-lg border border-slate-700 bg-[#0f1118] px-3 py-2 text-sm text-slate-400">
              Loading upload history...
            </p>
          ) : recentDocuments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 bg-[#0f1118] px-3 py-2 text-sm text-slate-500">
              No uploaded files yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentDocuments.map((document) => (
                <li
                  key={document.id}
                  className="rounded-lg border border-slate-700 bg-[#0f1118] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setSelectedDocument(document)}
                      type="button"
                    >
                      <p className="truncate text-sm font-medium text-slate-100">
                        {document.fileName}
                      </p>
                      <p className="mt-1 text-xs italic text-slate-500">
                        {planningDocumentIds.has(document.id)
                          ? "Used for planning"
                          : `Uploaded ${describeUploadTime(document.createdAt)}`}
                      </p>
                    </button>
                    <button
                      className="rounded-md border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                      onClick={() => setSelectedDocument(document)}
                      type="button"
                    >
                      Preview
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {toReadableSize(document.sizeBytes)} · {document.mimeType}
                  </p>

                  {isAdmin ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-md border border-rose-400/60 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"
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
      </div>

      <DocumentPreviewModal
        document={selectedDocument}
        onClose={() => setSelectedDocument(null)}
        projectId={projectId}
      />
    </section>
  );
}
