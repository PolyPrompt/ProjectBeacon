import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingleMock = vi.fn();
const insertMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();

const queryBuilder = {
  select: selectMock,
  eq: eqMock,
  maybeSingle: maybeSingleMock,
  insert: insertMock,
};

const fromMock = vi.fn(() => queryBuilder);
const supabaseMock = { from: fromMock };

vi.mock("@/lib/env", () => ({
  getEnv: () =>
    ({
      CLERK_SECRET_KEY: "unit-test-secret",
    }) as never,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceSupabaseClient: () => supabaseMock,
}));

import {
  createProjectJoinToken,
  joinProjectWithToken,
  verifyProjectJoinToken,
} from "@/lib/projects/share-token";

describe("project share token helpers", () => {
  beforeEach(() => {
    fromMock.mockReset();
    selectMock.mockReset();
    eqMock.mockReset();
    maybeSingleMock.mockReset();
    insertMock.mockReset();

    selectMock.mockReturnValue(queryBuilder);
    eqMock.mockReturnValue(queryBuilder);
    fromMock.mockReturnValue(queryBuilder);
  });

  it("creates and verifies a join token", async () => {
    const { token } = await createProjectJoinToken({
      projectId: "project-1",
      issuerUserId: "user-1",
    });

    await expect(verifyProjectJoinToken(token)).resolves.toEqual({
      projectId: "project-1",
    });
  });

  it("rejects invalid join token payload", async () => {
    await expect(verifyProjectJoinToken("invalid-token")).rejects.toMatchObject(
      {
        status: 400,
        code: "INVALID_TOKEN",
      },
    );
  });

  it("returns alreadyMember when membership already exists", async () => {
    const { token } = await createProjectJoinToken({
      projectId: "project-1",
      issuerUserId: "user-1",
    });

    maybeSingleMock.mockResolvedValue({
      data: { project_id: "project-1", user_id: "user-2" },
      error: null,
    });

    const result = await joinProjectWithToken({
      token,
      userId: "user-2",
    });

    expect(result).toEqual({
      projectId: "project-1",
      userId: "user-2",
      joined: true,
      alreadyMember: true,
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("inserts membership when user is new to project", async () => {
    const { token } = await createProjectJoinToken({
      projectId: "project-1",
      issuerUserId: "user-1",
    });

    maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
    insertMock.mockResolvedValue({ error: null });

    const result = await joinProjectWithToken({
      token,
      userId: "user-3",
    });

    expect(insertMock).toHaveBeenCalledWith({
      project_id: "project-1",
      user_id: "user-3",
      role: "member",
    });
    expect(result).toEqual({
      projectId: "project-1",
      userId: "user-3",
      joined: true,
      alreadyMember: false,
    });
  });
});
