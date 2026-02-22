import { defineConfig, devices } from "@playwright/test";

const PORT = 3001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  outputDir: "test-results/playwright",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${PORT}`,
    env: {
      E2E_BYPASS_AUTH: "true",
      E2E_TEST_CLERK_USER_ID: "e2e-clerk-user",
      E2E_TEST_USER_ID: "e2e-user",
      E2E_TEST_ROLE: "admin",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: `${BASE_URL}/projects/new`,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
