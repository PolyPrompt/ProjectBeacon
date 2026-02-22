import { expect, test, type Page } from "@playwright/test";

import { E2E_PROJECT_ID, fulfillJson, stubBootstrapUser } from "./helpers";

const PROJECT_DEADLINE_ISO = "2030-03-15T23:59:59.000Z";
const SHARE_URL = `http://127.0.0.1:3001/join/mock-share-token`;

type ShareEmailResult = {
  failed: Array<{ email: string; reason: string }>;
  sent: Array<{ email: string; status: "sent" }>;
};

async function stubProjectSetupApis(
  page: Page,
  shareEmailResult: ShareEmailResult,
): Promise<void> {
  await stubBootstrapUser(page);

  await page.route("**/api/projects", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await fulfillJson(route, {
      id: E2E_PROJECT_ID,
      name: "Nexus Redesign",
      description: "Migrate dashboard and delegation workflows.",
      deadline: PROJECT_DEADLINE_ISO,
      ownerUserId: "e2e-user",
      planningStatus: "draft",
    });
  });

  await page.route(
    `**/api/projects/${E2E_PROJECT_ID}/share-link`,
    async (route) => {
      await fulfillJson(route, {
        projectId: E2E_PROJECT_ID,
        token: "mock-share-token",
        expiresAt: "2030-03-22T23:59:59.000Z",
        joinUrl: SHARE_URL,
      });
    },
  );

  await page.route(
    `**/api/projects/${E2E_PROJECT_ID}/share-email`,
    async (route) => {
      await fulfillJson(route, {
        projectId: E2E_PROJECT_ID,
        sent: shareEmailResult.sent,
        failed: shareEmailResult.failed,
      });
    },
  );
}

async function createProjectAndGenerateShareLink(page: Page): Promise<void> {
  await page.goto("/projects/new");

  await expect(
    page.getByRole("heading", { name: "Start Your Project" }),
  ).toBeVisible();

  await page.getByLabel("Project Name").fill("Nexus Redesign");
  await page
    .getByLabel("Description")
    .fill("Migrate dashboard and delegation workflows.");
  await page.getByLabel("Main Deadline").fill("2030-03-15");
  await page.getByPlaceholder("Full name").fill("Alex Rivera");
  await page.getByPlaceholder("Email address").fill("alex@university.edu");

  await page.getByRole("button", { name: "Create Project Workspace" }).click();

  await expect(page.getByText("Active project context")).toBeVisible();
  await expect(page.getByText(`Project ID: ${E2E_PROJECT_ID}`)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continue to Workspace Intake" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Generate Share Link" }).click();
  await expect(page.getByText(SHARE_URL)).toBeVisible();
}

test("keeps project context visible after create, share-link, and send-invite flow", async ({
  page,
}) => {
  await stubProjectSetupApis(page, {
    sent: [
      { email: "alex@university.edu", status: "sent" },
      { email: "sarah@university.edu", status: "sent" },
    ],
    failed: [],
  });

  await createProjectAndGenerateShareLink(page);

  const shareEmailForm = page
    .locator("form")
    .filter({ hasText: "Share by Email" });
  await shareEmailForm
    .getByPlaceholder("teammate1@school.edu, teammate2@school.edu")
    .fill("alex@university.edu,sarah@university.edu");
  await shareEmailForm.getByRole("button", { name: "Send invites" }).click();

  await expect(page.getByText("Sent: 2 · Failed: 0")).toBeVisible();
  await expect(page.getByText("Active project context")).toBeVisible();
  await expect(page.getByText(`Project ID: ${E2E_PROJECT_ID}`)).toBeVisible();
});

test("shows partial share-email failures without resetting active project context", async ({
  page,
}) => {
  await stubProjectSetupApis(page, {
    sent: [{ email: "alex@university.edu", status: "sent" }],
    failed: [{ email: "bad-email", reason: "Invalid email" }],
  });

  await createProjectAndGenerateShareLink(page);

  const shareEmailForm = page
    .locator("form")
    .filter({ hasText: "Share by Email" });
  await shareEmailForm
    .getByPlaceholder("teammate1@school.edu, teammate2@school.edu")
    .fill("alex@university.edu,bad-email");
  await shareEmailForm.getByRole("button", { name: "Send invites" }).click();

  await expect(page.getByText("Sent: 1 · Failed: 1")).toBeVisible();
  await expect(page.getByText("bad-email: Invalid email")).toBeVisible();
  await expect(page.getByText("Active project context")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Project Dashboard" }),
  ).toBeVisible();
});
