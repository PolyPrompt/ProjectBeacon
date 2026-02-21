import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock, ensureSkillByNameMock, getServiceSupabaseClientMock } =
  vi.hoisted(() => ({
    requireUserMock: vi.fn(),
    ensureSkillByNameMock: vi.fn(),
    getServiceSupabaseClientMock: vi.fn(),
  }));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/skills/ensure-skill", () => ({
  ensureSkillByName: ensureSkillByNameMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

import { PATCH, POST } from "@/app/api/me/skills/route";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const USER_SKILL_ID = "44444444-4444-4444-8444-444444444444";

describe("/api/me/skills route", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    ensureSkillByNameMock.mockReset();
    getServiceSupabaseClientMock.mockReset();

    requireUserMock.mockResolvedValue({
      userId: USER_ID,
      clerkUserId: "clerk-user-1",
    });
  });

  it("POST validates payload and returns validation error", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        skillName: "React",
        level: 9,
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(ensureSkillByNameMock).not.toHaveBeenCalled();
  });

  it("POST upserts and maps skill response shape", async () => {
    ensureSkillByNameMock.mockResolvedValue({
      id: "skill-1",
      name: "React",
    });

    const userSkillsTable = {
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "user-skill-1",
              skill_id: "skill-1",
              level: 4,
            },
            error: null,
          }),
        })),
      })),
    };

    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => userSkillsTable),
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

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      id: "user-skill-1",
      skillId: "skill-1",
      skillName: "React",
      level: 4,
    });
  });

  it("PATCH returns NOT_FOUND when no owned skill row exists", async () => {
    const userSkillsTable = {
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            })),
          })),
        })),
      })),
    };

    getServiceSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => userSkillsTable),
    });

    const request = new Request("http://localhost", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        id: USER_SKILL_ID,
        level: 3,
      }),
    });

    const response = await PATCH(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Skill row not found",
      },
    });
  });
});
