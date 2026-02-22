import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "@/lib/api/errors";

const {
  requireUserMock,
  requireProjectMemberMock,
  uploadProjectDocumentMock,
  getServiceSupabaseClientMock,
} = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  requireProjectMemberMock: vi.fn(),
  uploadProjectDocumentMock: vi.fn(),
  getServiceSupabaseClientMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/projects/membership", () => ({
  requireProjectMember: requireProjectMemberMock,
}));

vi.mock("@/lib/storage/upload-project-document", () => ({
  uploadProjectDocument: uploadProjectDocumentMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { GET, POST } from "@/app/api/projects/[projectId]/documents/route";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

describe("project documents route", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    requireProjectMemberMock.mockReset();
    uploadProjectDocumentMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    requireUserMock.mockResolvedValue({
      userId: USER_ID,
      clerkUserId: "clerk-user-1",
    });
    requireProjectMemberMock.mockResolvedValue({
      projectId: PROJECT_ID,
      userId: USER_ID,
      role: "member",
    });
  });

  it("GET maps document rows to API contract", async () => {
    const rows = [
      {
        id: "doc-1",
        project_id: PROJECT_ID,
        file_name: "requirements.pdf",
        mime_type: "application/pdf",
        size_bytes: 1234,
        storage_key: "projects/p/docs/doc-1-requirements.pdf",
        uploaded_by_user_id: USER_ID,
        created_at: "2026-02-21T00:00:00.000Z",
      },
    ];

    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: rows,
              error: null,
            }),
          })),
        })),
      })),
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ projectId: PROJECT_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      documents: [
        {
          id: "doc-1",
          projectId: PROJECT_ID,
          fileName: "requirements.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1234,
          storageKey: "projects/p/docs/doc-1-requirements.pdf",
          createdAt: "2026-02-21T00:00:00.000Z",
        },
      ],
    });
  });

  it("POST rejects when multipart file field is missing", async () => {
    const formData = new FormData();
    formData.set("title", "missing-file");

    const request = new Request("http://localhost", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, {
      params: Promise.resolve({ projectId: PROJECT_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Expected multipart form field `file`",
      },
    });
    expect(uploadProjectDocumentMock).not.toHaveBeenCalled();
  });

  it("POST returns uploaded document payload on success", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const formData = new FormData();
    formData.set("file", file);

    uploadProjectDocumentMock.mockResolvedValue({
      id: "doc-2",
      projectId: PROJECT_ID,
      fileName: "notes.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      storageKey: "projects/p/docs/doc-2-notes.txt",
      uploadedByUserId: USER_ID,
      createdAt: "2026-02-21T00:00:00.000Z",
    });

    const request = new Request("http://localhost", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, {
      params: Promise.resolve({ projectId: PROJECT_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(uploadProjectDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        uploadedByUserId: USER_ID,
        file: expect.any(File),
      }),
    );
    const uploadInput = uploadProjectDocumentMock.mock.calls[0]?.[0];
    expect(uploadInput?.file.name).toBe(file.name);
    expect(uploadInput?.file.type).toBe(file.type);
    expect(body).toEqual({
      document: {
        id: "doc-2",
        projectId: PROJECT_ID,
        fileName: "notes.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
        storageKey: "projects/p/docs/doc-2-notes.txt",
        createdAt: "2026-02-21T00:00:00.000Z",
      },
    });
  });

  it("POST returns contract-compliant API error when upload fails", async () => {
    const file = new File(["bad"], "bad.txt", { type: "text/plain" });
    const formData = new FormData();
    formData.set("file", file);

    uploadProjectDocumentMock.mockRejectedValue(
      new ApiHttpError(500, "STORAGE_ERROR", "storage unavailable", {
        reason: "timeout",
      }),
    );

    const request = new Request("http://localhost", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, {
      params: Promise.resolve({ projectId: PROJECT_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: {
        code: "STORAGE_ERROR",
        message: "storage unavailable",
        details: { reason: "timeout" },
      },
    });
  });
});
