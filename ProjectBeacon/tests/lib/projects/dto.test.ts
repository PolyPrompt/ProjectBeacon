import { describe, expect, it } from "vitest";

import { toProjectPayload } from "@/lib/projects/dto";

describe("toProjectPayload", () => {
  it("maps project row fields to API payload", () => {
    const payload = toProjectPayload({
      id: "project-1",
      name: "Capstone",
      description: "Team capstone",
      deadline: "2026-03-20T00:00:00.000Z",
      owner_user_id: "user-1",
      planning_status: "draft",
      created_at: "2026-02-21T00:00:00.000Z",
      updated_at: "2026-02-21T00:00:00.000Z",
    });

    expect(payload).toEqual({
      id: "project-1",
      name: "Capstone",
      description: "Team capstone",
      deadline: "2026-03-20T00:00:00.000Z",
      ownerUserId: "user-1",
      planningStatus: "draft",
    });
  });
});
