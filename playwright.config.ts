import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:3000",
    launchOptions: {
      executablePath: process.env.CHROMIUM_EXECUTABLE || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    viewport: { width: 1440, height: 1080 },
  },
  // Test the production build: the dev server refuses client chunks to 127.0.0.1, so the page never hydrates.
  webServer: { command: "npm run build && npm run start -- --port 3000", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI, timeout: 180_000 },
});
