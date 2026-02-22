import { expect, test, type Page } from "@playwright/test";

import { E2E_PROJECT_ID, fulfillJson, stubBootstrapUser } from "./helpers";

async function stubBoardAndTimelineApis(page: Page): Promise<void> {
  await stubBootstrapUser(page);

  await page.route(`**/api/projects/${E2E_PROJECT_ID}`, async (route) => {
    await fulfillJson(route, {
      id: E2E_PROJECT_ID,
      name: "Project Aurora",
      description: "Delegation board smoke test project.",
      deadline: "2030-03-22T23:59:59.000Z",
      planningStatus: "draft",
    });
  });

  await page.route(
    `**/api/projects/${E2E_PROJECT_ID}/workflow/board`,
    async (route) => {
      await fulfillJson(route, {
        capability: {
          role: "admin",
          canManageProject: true,
          canEditWorkflow: true,
        },
        columns: [
          {
            userId: "member-1",
            name: "Alex",
            email: "alex@university.edu",
            role: "admin",
            tasks: [
              {
                id: "task-board-1",
                title: "API Authentication Core",
                status: "in_progress",
                softDeadline: "2030-03-09T23:59:59.000Z",
                difficultyPoints: 5,
                phase: "middle",
              },
            ],
          },
        ],
        unassigned: [
          {
            id: "task-board-2",
            title: "Unit Test Coverage",
            status: "todo",
            softDeadline: null,
            difficultyPoints: 2,
            phase: "end",
          },
        ],
      });
    },
  );

  await page.route(
    `**/api/projects/${E2E_PROJECT_ID}/workflow/timeline**`,
    async (route) => {
      await fulfillJson(route, {
        capability: {
          role: "admin",
          canManageProject: true,
          canEditWorkflow: true,
        },
        tasks: [
          {
            id: "task-tl-1",
            title: "Architecture Schema v1",
            status: "done",
            softDeadline: "2030-03-02T23:59:59.000Z",
            difficultyPoints: 3,
            assigneeUserId: "member-1",
            sequenceIndex: 0,
            totalTasks: 2,
            phase: "beginning",
            dueDatePlacement: "early",
          },
          {
            id: "task-tl-2",
            title: "API Authentication Core",
            status: "blocked",
            softDeadline: "2030-03-09T23:59:59.000Z",
            difficultyPoints: 5,
            assigneeUserId: "member-1",
            sequenceIndex: 1,
            totalTasks: 2,
            phase: "middle",
            dueDatePlacement: "mid",
          },
        ],
        edges: [{ taskId: "task-tl-2", dependsOnTaskId: "task-tl-1" }],
      });
    },
  );
}

test("board route renders key task state and navigation shell", async ({
  page,
}) => {
  await stubBoardAndTimelineApis(page);
  await page.goto(`/projects/${E2E_PROJECT_ID}/board`);

  await expect(page.getByText(/Workflow Board|Sprint Board/i)).toBeVisible();
  await expect(page.getByText("API Authentication Core")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Alex" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Timeline" }).first(),
  ).toBeVisible();
});

test("timeline route renders heading, countdown context, and dependency state", async ({
  page,
}) => {
  await stubBoardAndTimelineApis(page);
  await page.goto(`/projects/${E2E_PROJECT_ID}/timeline`);

  await expect(page.getByText("Project Timeline")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Micro-Goal Dependency View" }),
  ).toBeVisible();
  await expect(page.getByText("Countdown To Final Milestone")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "API Authentication Core" }),
  ).toBeVisible();
  await expect(page.getByText("Support Signal")).toBeVisible();
});
