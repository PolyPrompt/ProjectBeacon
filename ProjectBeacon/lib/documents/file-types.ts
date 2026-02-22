export const PROJECT_DOCUMENT_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".txt",
] as const;

export const PROJECT_DOCUMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export const PROJECT_DOCUMENT_ACCEPT_ATTR =
  PROJECT_DOCUMENT_ALLOWED_EXTENSIONS.join(",");

export const PROJECT_DOCUMENT_ALLOWED_TYPES_LABEL = "PDF, DOCX, or TXT";

const ALLOWED_EXTENSION_SET = new Set(PROJECT_DOCUMENT_ALLOWED_EXTENSIONS);
const ALLOWED_MIME_SET = new Set(PROJECT_DOCUMENT_ALLOWED_MIME_TYPES);
const FALLBACK_MIME_SET = new Set(["", "application/octet-stream"]);

function getFileExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const dotIndex = trimmed.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return "";
  }

  return trimmed.slice(dotIndex);
}

export function isAllowedProjectDocumentExtension(fileName: string): boolean {
  return ALLOWED_EXTENSION_SET.has(getFileExtension(fileName));
}

export function isAllowedProjectDocumentMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_SET.has(mimeType.trim().toLowerCase());
}

export function isPermittedProjectDocumentFile(input: {
  fileName: string;
  mimeType: string | null | undefined;
}): boolean {
  if (!isAllowedProjectDocumentExtension(input.fileName)) {
    return false;
  }

  const normalizedMimeType = (input.mimeType ?? "").trim().toLowerCase();
  return (
    ALLOWED_MIME_SET.has(normalizedMimeType) ||
    FALLBACK_MIME_SET.has(normalizedMimeType)
  );
}
