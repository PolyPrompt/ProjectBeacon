"use client";

import { useCallback, useEffect, useState } from "react";

type ProjectDocument = {
  id: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedByUserId: string;
  createdAt: string;
};

export function ProjectDocumentsUploader({ projectId }: { projectId: string }) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const loadDocuments = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/documents`);
    const data = await response.json();

    if (!response.ok) {
      setError(data?.error?.message ?? "Failed to load documents");
      return;
    }

    setDocuments(data.documents ?? []);
  }, [projectId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data?.error?.message ?? "Upload failed");
        return;
      }

      await loadDocuments();
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <section className="space-y-4 rounded border border-black/10 bg-white p-6">
      <h2 className="text-xl font-semibold">Project Documents</h2>
      <label className="inline-flex cursor-pointer items-center rounded border border-black/20 px-3 py-2 text-sm">
        <input
          className="hidden"
          type="file"
          onChange={onFileChange}
          disabled={isUploading}
        />
        {isUploading ? "Uploading..." : "Upload document"}
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="space-y-2 text-sm">
        {documents.map((document) => (
          <li key={document.id} className="rounded border border-black/10 p-3">
            <p className="font-medium">{document.fileName}</p>
            <p className="text-black/70">{document.mimeType}</p>
            <p className="text-black/70">{document.sizeBytes} bytes</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
