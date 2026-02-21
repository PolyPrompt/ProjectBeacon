import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadMock = vi.fn();
const storageFromMock = vi.fn(() => ({
  upload: uploadMock,
}));

const singleMock = vi.fn();
const selectMock = vi.fn(() => ({
  single: singleMock,
}));
const insertMock = vi.fn(() => ({
  select: selectMock,
}));
const fromMock = vi.fn(() => ({
  insert: insertMock,
}));

const supabaseMock = {
  storage: {
    from: storageFromMock,
  },
  from: fromMock,
};

vi.mock("@/lib/env", () => ({
  getEnv: () =>
    ({
      SUPABASE_STORAGE_BUCKET: "project-documents",
    }) as never,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceSupabaseClient: () => supabaseMock,
}));

import { uploadProjectDocument } from "@/lib/storage/upload-project-document";

describe("uploadProjectDocument", () => {
  beforeEach(() => {
    uploadMock.mockReset();
    storageFromMock.mockReset();
    singleMock.mockReset();
    selectMock.mockReset();
    insertMock.mockReset();
    fromMock.mockReset();

    storageFromMock.mockReturnValue({
      upload: uploadMock,
    });
    selectMock.mockReturnValue({
      single: singleMock,
    });
    insertMock.mockReturnValue({
      select: selectMock,
    });
    fromMock.mockReturnValue({
      insert: insertMock,
    });
  });

  it("rejects unsupported mime types", async () => {
    const file = new File(["abc"], "image.png", { type: "image/png" });

    await expect(
      uploadProjectDocument({
        projectId: "project-1",
        uploadedByUserId: "user-1",
        file,
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "UNSUPPORTED_FILE_TYPE",
    });
  });

  it("rejects files larger than 15MB", async () => {
    const file = new File([new Uint8Array(15 * 1024 * 1024 + 1)], "huge.pdf", {
      type: "application/pdf",
    });

    await expect(
      uploadProjectDocument({
        projectId: "project-1",
        uploadedByUserId: "user-1",
        file,
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "FILE_TOO_LARGE",
    });
  });

  it("uploads file and persists metadata", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("doc-fixed");

    uploadMock.mockResolvedValue({ error: null });
    singleMock.mockResolvedValue({
      data: {
        id: "doc-fixed",
        project_id: "project-1",
        storage_key: "projects/project-1/docs/doc-fixed-requirements_plan_.pdf",
        file_name: "requirements plan?.pdf",
        mime_type: "application/pdf",
        size_bytes: 7,
        uploaded_by_user_id: "user-1",
        created_at: "2026-02-21T00:00:00.000Z",
      },
      error: null,
    });

    const file = new File(["content"], "requirements plan?.pdf", {
      type: "application/pdf",
    });

    const result = await uploadProjectDocument({
      projectId: "project-1",
      uploadedByUserId: "user-1",
      file,
    });

    expect(storageFromMock).toHaveBeenCalledWith("project-documents");
    expect(uploadMock).toHaveBeenCalledWith(
      "projects/project-1/docs/doc-fixed-requirements_plan_.pdf",
      file,
      {
        contentType: "application/pdf",
        upsert: false,
      },
    );
    expect(insertMock).toHaveBeenCalledWith({
      id: "doc-fixed",
      project_id: "project-1",
      storage_key: "projects/project-1/docs/doc-fixed-requirements_plan_.pdf",
      file_name: "requirements plan?.pdf",
      mime_type: "application/pdf",
      size_bytes: 7,
      uploaded_by_user_id: "user-1",
    });
    expect(result).toEqual({
      id: "doc-fixed",
      projectId: "project-1",
      fileName: "requirements plan?.pdf",
      mimeType: "application/pdf",
      sizeBytes: 7,
      storageKey: "projects/project-1/docs/doc-fixed-requirements_plan_.pdf",
      uploadedByUserId: "user-1",
      createdAt: "2026-02-21T00:00:00.000Z",
    });
  });
});
