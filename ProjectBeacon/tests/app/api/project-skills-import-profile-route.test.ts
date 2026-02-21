import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireUserMock,
  requireProjectMemberMock,
  requireProjectOwnerMock,
  getServiceSupabaseClientMock,
} = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  requireProjectMemberMock: vi.fn(),
  requireProjectOwnerMock: vi.fn(),
  getServiceSupabaseClientMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/projects/membership", () => ({
  requireProjectMember: requireProjectMemberMock,
  requireProjectOwner: requireProjectOwnerMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { POST } from "@/app/api/projects/[projectId]/skills/import-profile/route";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";

describe("project skill import-profile route", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    requireProjectMemberMock.mockReset();
    requireProjectOwnerMock.mockReset();
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
    requireProjectOwnerMock.mockResolvedValue({
      projectId: PROJECT_ID,
      userId: USER_ID,
      role: "owner",
    });
  });

  it("returns FORBIDDEN when target user is not in project", async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === "project_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    getServiceSupabaseClientMock.mockReturnValue({
      from: fromMock,
    });

    const request = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId: OTHER_USER_ID,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({
        projectId: PROJECT_ID,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Target user is not a member of this project",
      },
    });
  });

  it("returns zero import counts for users without profile skills", async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === "project_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { user_id: USER_ID },
                  error: null,
                }),
              })),
            })),
          })),
        };
      }

      if (table === "user_skills") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    getServiceSupabaseClientMock.mockReturnValue({
      from: fromMock,
    });

    const request = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request, {
      params: Promise.resolve({
        projectId: PROJECT_ID,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      imported: 0,
      updated: 0,
    });
  });
});
