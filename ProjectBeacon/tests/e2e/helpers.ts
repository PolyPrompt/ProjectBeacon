import type { Page, Route } from "@playwright/test";

export const E2E_PROJECT_ID = "11111111-1111-1111-1111-111111111111";

export async function fulfillJson(
  route: Route,
  payload: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    contentType: "application/json",
    status,
    body: JSON.stringify(payload),
  });
}

export async function stubBootstrapUser(page: Page): Promise<void> {
  await page.route("**/api/users/bootstrap", async (route) => {
    await fulfillJson(route, {
      user: {
        id: "e2e-user",
      },
    });
  });
}
