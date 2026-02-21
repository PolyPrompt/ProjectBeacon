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

import { GET, POST } from "@/app/api/projects/[projectId]/members/route";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const MEMBER_ID = "33333333-3333-4333-8333-333333333333";

describe("project members route", () => {
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

  it("GET maps member and profile fields to API shape", async () => {
    const members = [
      { user_id: USER_ID, role: "owner" },
      { user_id: MEMBER_ID, role: "member" },
    ];
    const users = [
      { id: USER_ID, name: "Ada", email: "ada@example.com" },
      { id: MEMBER_ID, name: "Linus", email: "linus@example.com" },
    ];

    const fromMock = vi.fn((table: string) => {
      if (table === "project_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: members,
              error: null,
            }),
          })),
        };
      }

      if (table === "users") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: users,
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

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({
        projectId: PROJECT_ID,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      members: [
        {
          userId: USER_ID,
          name: "Ada",
          email: "ada@example.com",
          role: "owner",
        },
        {
          userId: MEMBER_ID,
          name: "Linus",
          email: "linus@example.com",
          role: "member",
        },
      ],
    });
  });

  it("POST returns validation error for invalid projectId param", async () => {
    const response = await POST(
      new Request("http://localhost", { method: "POST" }),
      {
        params: Promise.resolve({
          projectId: "not-a-uuid",
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST upserts member and returns camelCase payload", async () => {
    const member = {
      project_id: PROJECT_ID,
      user_id: MEMBER_ID,
      role: "member",
    };

    const projectMembersTable = {
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: member,
            error: null,
          }),
        })),
      })),
    };

    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => projectMembersTable),
    });

    const request = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId: MEMBER_ID,
        role: "member",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({
        projectId: PROJECT_ID,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      projectId: PROJECT_ID,
      userId: MEMBER_ID,
      role: "member",
    });
  });
});
