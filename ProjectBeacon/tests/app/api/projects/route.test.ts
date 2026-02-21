import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock, getServiceSupabaseClientMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getServiceSupabaseClientMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { POST } from "@/app/api/projects/route";

describe("POST /api/projects", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    requireUserMock.mockResolvedValue({
      userId: "user-1",
      clerkUserId: "clerk-user-1",
    });
  });

  it("rejects past deadline", async () => {
    const request = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: "Capstone",
        description: "Project details",
        deadline: new Date(Date.now() - 60_000).toISOString(),
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Deadline must be in the future",
      },
    });
    expect(getServiceSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("creates project and owner membership", async () => {
    const deadline = new Date(Date.now() + 60_000).toISOString();

    const projectSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: "project-1",
        name: "Capstone",
        description: "Project details",
        deadline,
        owner_user_id: "user-1",
        planning_status: "draft",
        created_at: "2026-02-21T00:00:00.000Z",
        updated_at: "2026-02-21T00:00:00.000Z",
      },
      error: null,
    });

    const projectSelectMock = vi.fn().mockReturnValue({
      single: projectSingleMock,
    });

    const projectInsertMock = vi.fn().mockReturnValue({
      select: projectSelectMock,
    });

    const memberInsertMock = vi.fn().mockResolvedValue({
      error: null,
    });

    const fromMock = vi.fn((table: string) => {
      if (table === "projects") {
        return {
          insert: projectInsertMock,
        };
      }

      if (table === "project_members") {
        return {
          insert: memberInsertMock,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    getServiceSupabaseClientMock.mockReturnValue({
      from: fromMock,
    });

    const request = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: "Capstone",
        description: "Project details",
        deadline,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(projectInsertMock).toHaveBeenCalledWith({
      name: "Capstone",
      description: "Project details",
      deadline,
      owner_user_id: "user-1",
      planning_status: "draft",
    });
    expect(memberInsertMock).toHaveBeenCalledWith({
      project_id: "project-1",
      user_id: "user-1",
      role: "owner",
    });
    expect(body).toEqual({
      id: "project-1",
      name: "Capstone",
      description: "Project details",
      deadline,
      ownerUserId: "user-1",
      planningStatus: "draft",
    });
  });
});
