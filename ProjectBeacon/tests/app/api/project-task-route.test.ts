import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireProjectAccessMock, selectSingleMock, updateRowsMock } =
  vi.hoisted(() => ({
    requireProjectAccessMock: vi.fn(),
    selectSingleMock: vi.fn(),
    updateRowsMock: vi.fn(),
  }));

vi.mock("@/lib/server/route-helpers", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/server/route-helpers")
  >("@/lib/server/route-helpers");

  return {
    ...actual,
    requireProjectAccess: requireProjectAccessMock,
  };
});

vi.mock("@/lib/server/supabase-rest", () => ({
  selectSingle: selectSingleMock,
  updateRows: updateRowsMock,
}));

import { PATCH } from "@/app/api/projects/[projectId]/tasks/[taskId]/route";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const TASK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";

function makeTaskRow(args?: {
  assigneeUserId?: string | null;
  status?: "todo" | "in_progress" | "blocked" | "done";
}) {
  return {
    id: TASK_ID,
    project_id: PROJECT_ID,
    assignee_user_id: args?.assigneeUserId ?? USER_ID,
    title: "Test task",
    description: "Task description",
    status: args?.status ?? "todo",
    difficulty_points: 3 as const,
    due_at: null,
    created_at: "2026-02-22T00:00:00.000Z",
    updated_at: "2026-02-22T00:00:00.000Z",
  };
}

describe("PATCH /api/projects/[projectId]/tasks/[taskId]", () => {
  beforeEach(() => {
    requireProjectAccessMock.mockReset();
    selectSingleMock.mockReset();
    updateRowsMock.mockReset();
  });

  it("blocks reassignment for non-admin members", async () => {
    requireProjectAccessMock.mockResolvedValue({
      ok: true,
      userId: USER_ID,
      membership: {
        id: "m1",
        project_id: PROJECT_ID,
        user_id: USER_ID,
        role: "member",
      },
      project: {
        id: PROJECT_ID,
        name: "Project",
        description: "desc",
        deadline: "2026-03-01T00:00:00.000Z",
        owner_user_id: USER_ID,
        planning_status: "assigned",
        created_at: "2026-02-22T00:00:00.000Z",
        updated_at: "2026-02-22T00:00:00.000Z",
      },
    });
    selectSingleMock.mockResolvedValueOnce(makeTaskRow());

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assigneeUserId: OTHER_USER_ID }),
      }),
      {
        params: Promise.resolve({
          projectId: PROJECT_ID,
          taskId: TASK_ID,
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(updateRowsMock).not.toHaveBeenCalled();
  });

  it("allows reassignment for admins", async () => {
    requireProjectAccessMock.mockResolvedValue({
      ok: true,
      userId: USER_ID,
      membership: {
        id: "m1",
        project_id: PROJECT_ID,
        user_id: USER_ID,
        role: "owner",
      },
      project: {
        id: PROJECT_ID,
        name: "Project",
        description: "desc",
        deadline: "2026-03-01T00:00:00.000Z",
        owner_user_id: USER_ID,
        planning_status: "assigned",
        created_at: "2026-02-22T00:00:00.000Z",
        updated_at: "2026-02-22T00:00:00.000Z",
      },
    });
    selectSingleMock
      .mockResolvedValueOnce(makeTaskRow())
      .mockResolvedValueOnce({
        id: "membership-2",
        project_id: PROJECT_ID,
        user_id: OTHER_USER_ID,
        role: "member",
      });
    updateRowsMock.mockResolvedValueOnce([
      makeTaskRow({
        assigneeUserId: OTHER_USER_ID,
      }),
    ]);

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assigneeUserId: OTHER_USER_ID }),
      }),
      {
        params: Promise.resolve({
          projectId: PROJECT_ID,
          taskId: TASK_ID,
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.task.assigneeUserId).toBe(OTHER_USER_ID);
    expect(updateRowsMock).toHaveBeenCalled();
  });

  it("still allows assignee status updates for non-admin members", async () => {
    requireProjectAccessMock.mockResolvedValue({
      ok: true,
      userId: USER_ID,
      membership: {
        id: "m1",
        project_id: PROJECT_ID,
        user_id: USER_ID,
        role: "member",
      },
      project: {
        id: PROJECT_ID,
        name: "Project",
        description: "desc",
        deadline: "2026-03-01T00:00:00.000Z",
        owner_user_id: USER_ID,
        planning_status: "assigned",
        created_at: "2026-02-22T00:00:00.000Z",
        updated_at: "2026-02-22T00:00:00.000Z",
      },
    });
    selectSingleMock.mockResolvedValueOnce(
      makeTaskRow({
        assigneeUserId: USER_ID,
        status: "todo",
      }),
    );
    updateRowsMock.mockResolvedValueOnce([
      makeTaskRow({
        assigneeUserId: USER_ID,
        status: "in_progress",
      }),
    ]);

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      }),
      {
        params: Promise.resolve({
          projectId: PROJECT_ID,
          taskId: TASK_ID,
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.task.status).toBe("in_progress");
    expect(updateRowsMock).toHaveBeenCalledWith(
      "tasks",
      { status: "in_progress" },
      {
        id: `eq.${TASK_ID}`,
        project_id: `eq.${PROJECT_ID}`,
      },
    );
  });
});
