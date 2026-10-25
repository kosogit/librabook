import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
export default defineConfig({
  testDir: "./tests/browser",
  testMatch:
    process.env.VITE_BROWSER_DEMO === "true" ? "app.spec.js" : "shared.spec.js",
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "win32" ? "msedge" : undefined),
    viewport: { width: 1440, height: 1080 },
  },
  workers: 1,
  reporter: "list",
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: { LIBRA_DATA_FILE: resolve("test-results/browser-workspace.json") },
    timeout: 30000,
  },
});
