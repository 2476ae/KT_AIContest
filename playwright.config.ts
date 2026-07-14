import { defineConfig, devices } from "@playwright/test";

const useExternalWebServer = process.env.MONEY_ROUTINE_E2E_EXTERNAL_SERVER === "1";
const baseUrl = process.env.MONEY_ROUTINE_E2E_BASE_URL ?? "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [["list"]],
  use: {
    baseURL: baseUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: useExternalWebServer
    ? undefined
    : {
        command: "node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173",
        env: {
          VITE_AI_PROVIDER: "openai-proxy",
        },
        reuseExistingServer: false,
        timeout: 60_000,
        url: "http://127.0.0.1:5173",
      },
  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        channel: "chrome",
      },
    },
  ],
});
