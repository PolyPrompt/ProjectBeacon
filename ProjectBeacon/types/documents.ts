export type ProjectDocumentDTO = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type DocumentsListDTO = {
  documents: ProjectDocumentDTO[];
};

export type DocumentViewDTO = {
  signedUrl: string;
  expiresAt?: string;
};
