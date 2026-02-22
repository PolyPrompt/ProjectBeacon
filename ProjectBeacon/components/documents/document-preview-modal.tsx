"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DocumentViewDTO, ProjectDocumentDTO } from "@/types/documents";

type DocumentPreviewModalProps = {
  document: ProjectDocumentDTO | null;
  projectId: string;
  onClose: () => void;
};

function isDocumentViewDTO(value: unknown): value is DocumentViewDTO {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return typeof payload.signedUrl === "string";
}

function extractSignedUrl(value: unknown): string | null {
  if (isDocumentViewDTO(value)) {
    return value.signedUrl;
  }

  if (value && typeof value === "object") {
    const payload = value as Record<string, unknown>;
    if (typeof payload.url === "string") {
      return payload.url;
    }

    if (
      payload.data &&
      typeof payload.data === "object" &&
      typeof (payload.data as Record<string, unknown>).signedUrl === "string"
    ) {
      return (payload.data as Record<string, string>).signedUrl;
    }
  }

  return null;
}

export function DocumentPreviewModal({
  document,
  projectId,
  onClose,
}: DocumentPreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!document) {
      setSignedUrl(null);
      setError(null);
      return;
    }

    const activeDocument = document;
    let cancelled = false;
    const controller = new AbortController();

    async function fetchSignedUrl() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `/api/projects/${projectId}/documents/${activeDocument.id}/view`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          let message = `Preview endpoint returned ${response.status}`;
          try {
            const payload = (await response.json()) as {
              error?: { message?: string };
            } | null;
            if (payload?.error?.message) {
              message = payload.error.message;
            }
          } catch {
            // Use default message when response body cannot be parsed.
          }
          throw new Error(message);
        }

        const json = (await response.json()) as unknown;
        const extractedUrl = extractSignedUrl(json);
        if (!extractedUrl) {
          throw new Error("Preview endpoint did not return a signed URL.");
        }

        if (!cancelled) {
          setSignedUrl(extractedUrl);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load document preview.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchSignedUrl();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [document, projectId]);

  if (!document) {
    return null;
  }

  const supportsEmbed =
    document.mimeType.includes("pdf") || document.mimeType.startsWith("image/");

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/45 p-4">
      <section className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Document Preview
            </p>
            <h2 className="text-base font-semibold text-slate-900">
              {document.fileName}
            </h2>
          </div>
          <button
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {loading ? (
          <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
            Retrieving signed preview URL...
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {!loading && !error && signedUrl ? (
          <div className="mt-4 space-y-3">
            {supportsEmbed ? (
              <iframe
                className="h-[70vh] w-full rounded-lg border border-slate-200"
                src={signedUrl}
                title={`Preview ${document.fileName}`}
              />
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Inline preview is not supported for this file type.
              </p>
            )}
            <Link
              className="inline-flex rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              href={signedUrl}
              rel="noreferrer noopener"
              target="_blank"
            >
              Open / Download
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
