import { listDocumentsForRole } from "@/lib/documents/access-policy";
import { getEnv } from "@/lib/env";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

type ProjectRole = "admin" | "user";

type DocumentContextBlock = {
  contextType: "document_extract";
  textContent: string;
};

type PlanningDocument = {
  id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  used_for_planning?: boolean | null;
  created_at: string;
};

const TEXT_MIME_TYPES = new Set(["text/plain", "text/markdown"]);
const PDF_MIME_TYPE = "application/pdf";
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MAX_PLANNING_DOCUMENTS = 6;
const MAX_CHARS_PER_DOCUMENT = 6_000;
const MAX_TOTAL_DOCUMENT_CHARS = 24_000;

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clip(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 16))}\n...[truncated]`;
}

async function downloadDocumentBytes(params: {
  bucket: string;
  storageKey: string;
}): Promise<Buffer> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.storage
    .from(params.bucket)
    .download(params.storageKey);

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to download document.");
  }

  const bytes = await data.arrayBuffer();
  return Buffer.from(bytes);
}

async function extractPdfText(pdfBytes: Buffer): Promise<string> {
  const pdfParseModule = (await import("pdf-parse")) as unknown as {
    default: (data: Uint8Array) => Promise<{ text?: string }>;
  };
  const parsed = await pdfParseModule.default(pdfBytes);
  return normalizeWhitespace(parsed.text ?? "");
}

async function extractDocxText(docxBytes: Buffer): Promise<string> {
  const mammothModule = (await import("mammoth")) as unknown as {
    extractRawText: (options: {
      buffer: Buffer;
    }) => Promise<{ value?: string }>;
  };
  const parsed = await mammothModule.extractRawText({ buffer: docxBytes });
  return normalizeWhitespace(parsed.value ?? "");
}

async function extractDocumentText(params: {
  document: PlanningDocument;
  bucket: string;
}): Promise<{ text: string; extractionNote: string | null }> {
  const { document, bucket } = params;

  const bytes = await downloadDocumentBytes({
    bucket,
    storageKey: document.storage_key,
  });

  if (TEXT_MIME_TYPES.has(document.mime_type)) {
    const text = normalizeWhitespace(bytes.toString("utf-8"));
    return {
      text,
      extractionNote: null,
    };
  }

  if (document.mime_type === PDF_MIME_TYPE) {
    const text = await extractPdfText(bytes);
    return {
      text,
      extractionNote: null,
    };
  }

  if (document.mime_type === DOCX_MIME_TYPE) {
    const text = await extractDocxText(bytes);
    return {
      text,
      extractionNote: null,
    };
  }

  return {
    text: "",
    extractionNote: `No extractor available for mime type ${document.mime_type}.`,
  };
}

function toDocumentContextText(params: {
  document: PlanningDocument;
  extractedText: string;
  extractionNote: string | null;
  maxChars: number;
}): string {
  const documentHeader = [
    `Document: ${params.document.file_name}`,
    `MimeType: ${params.document.mime_type}`,
    `SizeBytes: ${params.document.size_bytes}`,
    `CreatedAt: ${params.document.created_at}`,
  ].join("\n");

  const normalizedExtract = normalizeWhitespace(params.extractedText);

  const body =
    normalizedExtract.length > 0
      ? `ExtractedText:\n${normalizedExtract}`
      : `ExtractedText: unavailable\nReason: ${params.extractionNote ?? "No text content found."}`;

  return clip(`${documentHeader}\n\n${body}`, params.maxChars);
}

export async function buildPlanningDocumentContextBlocks(params: {
  projectId: string;
  actorUserId: string;
  role: ProjectRole;
}): Promise<DocumentContextBlock[]> {
  const env = getEnv();
  const supabase = getServiceSupabaseClient();

  const visibleDocuments = await listDocumentsForRole({
    supabase,
    projectId: params.projectId,
    role: params.role,
    actorUserId: params.actorUserId,
  });

  const planningDocuments = (visibleDocuments ?? [])
    .filter((document) => Boolean(document.used_for_planning))
    .slice(0, MAX_PLANNING_DOCUMENTS) as PlanningDocument[];

  const contextBlocks: DocumentContextBlock[] = [];
  let remainingChars = MAX_TOTAL_DOCUMENT_CHARS;

  for (const document of planningDocuments) {
    if (remainingChars <= 0) {
      break;
    }

    try {
      const { text, extractionNote } = await extractDocumentText({
        document,
        bucket: env.SUPABASE_STORAGE_BUCKET,
      });

      const textContent = toDocumentContextText({
        document,
        extractedText: text,
        extractionNote,
        maxChars: Math.min(MAX_CHARS_PER_DOCUMENT, remainingChars),
      });

      contextBlocks.push({
        contextType: "document_extract",
        textContent,
      });

      remainingChars -= textContent.length;
    } catch (error) {
      const fallbackText = clip(
        [
          `Document: ${document.file_name}`,
          `MimeType: ${document.mime_type}`,
          `SizeBytes: ${document.size_bytes}`,
          "ExtractedText: unavailable",
          `Reason: ${error instanceof Error ? error.message : "Unknown extraction error."}`,
        ].join("\n"),
        Math.min(MAX_CHARS_PER_DOCUMENT, remainingChars),
      );

      contextBlocks.push({
        contextType: "document_extract",
        textContent: fallbackText,
      });

      remainingChars -= fallbackText.length;
    }
  }

  return contextBlocks;
}
