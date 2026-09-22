import { defineConfig } from "@playwright/test";

const PORT = 3100; // porta própria para não colidir com o `npm run dev` (3000)

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Local: usa o Chrome instalado (sem baixar navegador). CI: Chromium do Playwright.
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
