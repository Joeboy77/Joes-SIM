import { defineConfig, devices } from "@playwright/test";

// An unusual port, so a dev server from another project is never reused by mistake.
const PORT = Number(process.env.E2E_PORT ?? 4317);
// The optional community service (apps/api), with a fresh local database for every run.
const API_PORT = 8789;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command:
        "rm -rf .wrangler/e2e && pnpm exec wrangler d1 migrations apply joes-sim --local --persist-to .wrangler/e2e" +
        ` && pnpm exec wrangler dev --port ${API_PORT} --persist-to .wrangler/e2e`,
      cwd: "../api",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      env: { NEXT_PUBLIC_COMMUNITY_API: `http://localhost:${API_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
