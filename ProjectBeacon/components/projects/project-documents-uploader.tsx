"use client";

import { useMemo, useRef, useState } from "react";

export type WorkspaceDocumentStatus = "processing" | "analyzed" | "error";

export type WorkspaceDocument = {
  id: string;
  fileName: string;
  createdAt: string;
  status: WorkspaceDocumentStatus;
  errorMessage?: string;
};

type ProjectUploadDropzoneProps = {
  disabled?: boolean;
  error: string | null;
  isUploading: boolean;
  onUpload: (file: File) => Promise<void> | void;
};

type ProjectRecentUploadsProps = {
  documents: WorkspaceDocument[];
  error: string | null;
  isLoading: boolean;
};

const STATUS_META: Record<
  WorkspaceDocumentStatus,
  {
    dotClass: string;
    icon: string;
    textClass: string;
  }
> = {
  analyzed: {
    dotClass: "bg-emerald-400",
    icon: "OK",
    textClass: "text-emerald-300",
  },
  error: {
    dotClass: "bg-red-400",
    icon: "ERR",
    textClass: "text-red-300",
  },
  processing: {
    dotClass: "bg-violet-400",
    icon: "...",
    textClass: "text-violet-300",
  },
};

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

export function ProjectUploadDropzone({
  disabled = false,
  error,
  isUploading,
  onUpload,
}: ProjectUploadDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function submitFile(file: File | null | undefined) {
    if (!file || disabled || isUploading) {
      return;
    }

    await onUpload(file);
  }

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-[#171821] p-6 transition ${
        isDragActive ? "ring-2 ring-violet-500/70" : ""
      }`}
    >
      <div className="pointer-events-none absolute inset-4 rounded-xl border border-dashed border-slate-700" />

      <div
        className="relative z-10 flex min-h-[17rem] flex-col items-center justify-center gap-5 rounded-xl px-6 py-8 text-center"
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragActive(true);
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragActive(true);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragActive(false);
          const file = event.dataTransfer.files?.[0];
          void submitFile(file);
        }}
      >
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-violet-500/15 text-sm font-semibold text-violet-200">
          UP
        </div>
        <div className="space-y-2">
          <h3 className="text-3xl font-semibold tracking-tight text-slate-100">
            Drag and drop files
          </h3>
          <p className="text-sm text-slate-400">
            PDF, DOCX, or TXT formats supported (max 50MB)
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md,text/plain,application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              void submitFile(file);
              event.target.value = "";
            }}
            disabled={disabled || isUploading}
          />
          <button
            type="button"
            className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-800/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
          >
            {isUploading ? "Uploading..." : "Browse Files"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="relative z-10 mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function ProjectRecentUploads({
  documents,
  error,
  isLoading,
}: ProjectRecentUploadsProps) {
  const sortedDocuments = useMemo(
    () =>
      [...documents].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [documents],
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#171821] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
          Recent Uploads
        </h3>
        <span className="text-xs text-violet-300">
          {sortedDocuments.length} file{sortedDocuments.length === 1 ? "" : "s"}
        </span>
      </div>

      {isLoading ? (
        <p className="rounded-lg border border-slate-700 bg-[#11121a] px-3 py-2 text-sm text-slate-400">
          Loading upload history...
        </p>
      ) : null}

      {!isLoading && sortedDocuments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 bg-[#11121a] px-3 py-2 text-sm text-slate-400">
          No uploaded files yet.
        </p>
      ) : null}

      {sortedDocuments.length > 0 ? (
        <ul className="space-y-2">
          {sortedDocuments.map((document) => {
            const statusMeta = STATUS_META[document.status];
            return (
              <li
                key={document.id}
                className="rounded-lg border border-slate-700 bg-[#11121a] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-slate-100">
                    {document.fileName}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMeta.textClass}`}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${statusMeta.dotClass}`}
                    />
                    {statusMeta.icon}
                  </span>
                </div>
                <p className={`mt-1 text-xs ${statusMeta.textClass}`}>
                  {document.status === "error"
                    ? (document.errorMessage ?? "Upload failed.")
                    : document.status === "processing"
                      ? "Processing..."
                      : `Analyzed ${describeUploadTime(document.createdAt)}`}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
