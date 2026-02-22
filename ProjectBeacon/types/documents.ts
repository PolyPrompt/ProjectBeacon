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

export type DocumentAccessDTO = {
  documentId: string;
  isPublic: boolean;
  assignedUserIds: string[];
  canManage: boolean;
};

export type DocumentViewDTO = {
  signedUrl: string;
  expiresAt?: string;
};
