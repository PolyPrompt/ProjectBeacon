import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  deleteRowsMock,
  insertRowsMock,
  requireProjectAccessMock,
  selectRowsMock,
  updateRowsMock,
} = vi.hoisted(() => ({
  deleteRowsMock: vi.fn(),
  insertRowsMock: vi.fn(),
  requireProjectAccessMock: vi.fn(),
  selectRowsMock: vi.fn(),
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
  deleteRows: deleteRowsMock,
  insertRows: insertRowsMock,
  selectRows: selectRowsMock,
  updateRows: updateRowsMock,
}));

import { POST } from "@/app/api/projects/[projectId]/tasks/sync/route";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function makeTaskRow(args: {
  id: string;
  title: string;
  difficultyPoints: 1 | 2 | 3 | 5 | 8;
}) {
  return {
    id: args.id,
    project_id: PROJECT_ID,
    assignee_user_id: null,
    title: args.title,
    description: "",
    difficulty_points: args.difficultyPoints,
    status: "todo",
    due_at: null,
    created_at: "2026-02-20T00:00:00.000Z",
    updated_at: "2026-02-20T00:00:00.000Z",
  };
}

describe("POST /api/projects/[projectId]/tasks/sync", () => {
  beforeEach(() => {
    deleteRowsMock.mockReset();
    insertRowsMock.mockReset();
    requireProjectAccessMock.mockReset();
    selectRowsMock.mockReset();
    updateRowsMock.mockReset();

    requireProjectAccessMock.mockResolvedValue({
      ok: true,
      userId: "22222222-2222-4222-8222-222222222222",
      membership: {
        id: "33333333-3333-4333-8333-333333333333",
        project_id: PROJECT_ID,
        user_id: "22222222-2222-4222-8222-222222222222",
        role: "owner",
      },
      project: {
        id: PROJECT_ID,
        name: "Test Project",
        description: "test",
        deadline: "2026-03-01T00:00:00.000Z",
        owner_user_id: "22222222-2222-4222-8222-222222222222",
        planning_status: "draft",
        created_at: "2026-02-20T00:00:00.000Z",
        updated_at: "2026-02-20T00:00:00.000Z",
      },
    });

    deleteRowsMock.mockResolvedValue([]);
    insertRowsMock.mockResolvedValue([]);
    updateRowsMock.mockResolvedValue([]);
  });

  it("allows saving with zero tasks and deletes all existing tasks", async () => {
    const existingTaskA = makeTaskRow({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Task A",
      difficultyPoints: 3,
    });
    const existingTaskB = makeTaskRow({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      title: "Task B",
      difficultyPoints: 5,
    });

    selectRowsMock.mockResolvedValue([existingTaskA, existingTaskB]);

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tasks: [],
        }),
      }),
      {
        params: Promise.resolve({
          projectId: PROJECT_ID,
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.taskCount).toBe(0);
    expect(body.deletedCount).toBe(2);

    expect(deleteRowsMock).toHaveBeenNthCalledWith(1, "task_required_skills", {
      task_id:
        "in.(aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb)",
    });
    expect(deleteRowsMock).toHaveBeenNthCalledWith(2, "task_dependencies", {
      task_id:
        "in.(aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb)",
    });
    expect(deleteRowsMock).toHaveBeenNthCalledWith(3, "task_dependencies", {
      depends_on_task_id:
        "in.(aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb)",
    });
    expect(deleteRowsMock).toHaveBeenNthCalledWith(4, "tasks", {
      id: "in.(aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa,bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb)",
      project_id: `eq.${PROJECT_ID}`,
    });
  });

  it("updates kept tasks and deletes removed tasks", async () => {
    const keepTask = makeTaskRow({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Old title",
      difficultyPoints: 3,
    });
    const removedTask = makeTaskRow({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      title: "Delete me",
      difficultyPoints: 2,
    });

    selectRowsMock.mockResolvedValue([keepTask, removedTask]);
    updateRowsMock.mockResolvedValue([keepTask]);

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tasks: [
            {
              id: keepTask.id,
              priority: "high",
              title: "Updated title",
            },
          ],
        }),
      }),
      {
        params: Promise.resolve({
          projectId: PROJECT_ID,
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.createdCount).toBe(0);
    expect(body.updatedCount).toBe(1);
    expect(body.deletedCount).toBe(1);
    expect(body.taskCount).toBe(1);
    expect(body.syncedTasks).toEqual([{ id: keepTask.id }]);

    expect(updateRowsMock).toHaveBeenCalledWith(
      "tasks",
      {
        title: "Updated title",
        difficulty_points: 5,
      },
      {
        id: `eq.${keepTask.id}`,
        project_id: `eq.${PROJECT_ID}`,
      },
    );

    expect(deleteRowsMock).toHaveBeenLastCalledWith("tasks", {
      id: `in.(${removedTask.id})`,
      project_id: `eq.${PROJECT_ID}`,
    });
  });

  it("rejects unknown task ids", async () => {
    selectRowsMock.mockResolvedValue([]);

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tasks: [
            {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              priority: "medium",
              title: "Unknown",
            },
          ],
        }),
      }),
      {
        params: Promise.resolve({
          projectId: PROJECT_ID,
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(deleteRowsMock).not.toHaveBeenCalled();
    expect(updateRowsMock).not.toHaveBeenCalled();
  });
});
