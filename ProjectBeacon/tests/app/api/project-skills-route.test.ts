import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireUserMock,
  requireProjectMemberMock,
  ensureSkillByNameMock,
  getServiceSupabaseClientMock,
} = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  requireProjectMemberMock: vi.fn(),
  ensureSkillByNameMock: vi.fn(),
  getServiceSupabaseClientMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/projects/membership", () => ({
  requireProjectMember: requireProjectMemberMock,
}));

vi.mock("@/lib/skills/ensure-skill", () => ({
  ensureSkillByName: ensureSkillByNameMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { POST } from "@/app/api/projects/[projectId]/skills/route";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";

describe("project skills route", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    requireProjectMemberMock.mockReset();
    ensureSkillByNameMock.mockReset();
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

  it("returns FORBIDDEN when target user is not a project member", async () => {
    const projectMembersTable = {
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

    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => projectMembersTable),
    });

    const request = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId: OTHER_USER_ID,
        skillName: "React",
        level: 4,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({
        projectId: PROJECT_ID,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(ensureSkillByNameMock).not.toHaveBeenCalled();
  });

  it("upserts override and returns mapped response", async () => {
    ensureSkillByNameMock.mockResolvedValue({
      id: "skill-1",
      name: "React",
    });

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

      if (table === "project_member_skills") {
        return {
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  user_id: USER_ID,
                  skill_id: "skill-1",
                  level: 4,
                },
                error: null,
              }),
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
        skillName: "React",
        level: 4,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({
        projectId: PROJECT_ID,
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      userId: USER_ID,
      skillId: "skill-1",
      skillName: "React",
      level: 4,
      source: "project_override",
    });
  });
});
