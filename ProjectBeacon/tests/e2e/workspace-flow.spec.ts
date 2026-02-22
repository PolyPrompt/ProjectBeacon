import { expect, test, type Page } from "@playwright/test";

import { E2E_PROJECT_ID, fulfillJson, stubBootstrapUser } from "./helpers";

async function stubWorkspaceApis(page: Page): Promise<void> {
  await stubBootstrapUser(page);

  await page.route(`**/api/projects/${E2E_PROJECT_ID}`, async (route) => {
    if (route.request().method() === "GET") {
      await fulfillJson(route, {
        id: E2E_PROJECT_ID,
        name: "Nexus Redesign",
        description: "Build a shared design system and delegation flow.",
        deadline: "2030-03-22T23:59:59.000Z",
        planningStatus: "draft",
      });
      return;
    }

    await route.continue();
  });

  await page.route(
    `**/api/projects/${E2E_PROJECT_ID}/documents`,
    async (route) => {
      await fulfillJson(route, {
        documents: [
          {
            id: "doc-1",
            fileName: "project-brief.pdf",
            createdAt: "2030-03-01T10:00:00.000Z",
          },
        ],
      });
    },
  );

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
                id: "task-1",
                title: "Implement design tokens",
                status: "in_progress",
                softDeadline: "2030-03-10T23:59:59.000Z",
                difficultyPoints: 3,
                phase: "beginning",
              },
            ],
          },
        ],
        unassigned: [
          {
            id: "task-2",
            title: "Cypress smoke pass",
            status: "todo",
            softDeadline: null,
            difficultyPoints: 2,
            phase: "middle",
          },
        ],
      });
    },
  );

  await page.route(
    `**/api/projects/${E2E_PROJECT_ID}/context/clarify`,
    async (route) => {
      await fulfillJson(route, {
        state: {
          confidence: 90,
          threshold: 85,
          askedCount: 2,
          maxQuestions: 5,
          readyForGeneration: true,
        },
        questions: [],
      });
    },
  );

  await page.route(
    `**/api/projects/${E2E_PROJECT_ID}/ai/generate-tasks`,
    async (route) => {
      await fulfillJson(route, {
        generation: {
          mode: "openai",
          reason: null,
          strictMode: false,
        },
        tasks: [{ id: "g-1" }, { id: "g-2" }],
      });
    },
  );
}

test("covers clarification and inventory transitions in workspace flow", async ({
  page,
}) => {
  await stubWorkspaceApis(page);
  await page.goto(`/projects/${E2E_PROJECT_ID}/workspace`);

  await expect(
    page.getByRole("heading", { name: "Upload Project Specs" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Clarification Checkpoint" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Task Inventory Blueprint" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Edit Specs" }).click();
  await expect(
    page.getByRole("button", { name: "Exit Edit Mode" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Saved local blueprint edits.")).toBeVisible();

  const clarificationProceedButton = page
    .getByRole("button", { name: "Proceed to Delegation" })
    .first();
  await expect(clarificationProceedButton).toBeVisible();
  await clarificationProceedButton.click();

  await expect(
    page.getByText("Generated 2 draft tasks using OpenAI."),
  ).toBeVisible();
  await expect(
    page.getByText("2 tasks currently loaded in the generated draft set."),
  ).toBeVisible();
});
