import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

// Run with `npm run test:e2e`, which builds first. The servers below start that one build
// three ways: browser-only, browser-only with a model, and accounts (when E2E_DATABASE_URL is set).
// Production builds are used because the dev server refuses client chunks to 127.0.0.1.
const accounts = process.env.E2E_DATABASE_URL;
const fakeModel = { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_BASE_URL: "http://127.0.0.1:4010", BILLIONS_MODEL: "fake" };
const fakeEmail = { RESEND_API_KEY: "test-resend-key", RESEND_BASE_URL: "http://127.0.0.1:4011", EMAIL_FROM: "Billions <test@example.com>", BILLIONS_APP_URL: "http://127.0.0.1:3001" };
const start = (port: number, env: Record<string, string>) => ({
  command: `npx next start --hostname 127.0.0.1 --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: !process.env.CI, timeout: 60_000,
  env: { ANTHROPIC_API_KEY: "", DATABASE_URL: "", RESEND_API_KEY: "", ...env },
});

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  use: {
    launchOptions: {
      executablePath: process.env.CHROMIUM_EXECUTABLE || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
    viewport: { width: 1440, height: 1080 },
  },
  projects: [
    { name: "browser-only", testMatch: "workspace.spec.ts", use: { baseURL: "http://127.0.0.1:3000" } },
    { name: "with-model", testMatch: ["model.spec.ts", "spreadsheet.spec.ts"], use: { baseURL: "http://127.0.0.1:3002" } },
    // A hosted database (Neon) adds network round trips and cold starts, so allow longer waits.
    ...(accounts ? [{ name: "accounts", testMatch: "accounts.spec.ts", use: { baseURL: "http://127.0.0.1:3001" }, expect: { timeout: 15_000 }, timeout: 90_000 }] : []),
  ],
  webServer: [
    { command: "node --experimental-strip-types tests/fake-anthropic.ts", url: "http://127.0.0.1:4010/health", reuseExistingServer: !process.env.CI },
    ...(accounts ? [{ command: "node --experimental-strip-types tests/fake-resend.ts", url: "http://127.0.0.1:4011/health", reuseExistingServer: !process.env.CI }] : []),
    start(3000, {}),
    start(3002, { ...fakeModel, BILLIONS_ANONYMOUS_AI: "on" }),
    ...(accounts ? [start(3001, { ...fakeModel, ...fakeEmail, DATABASE_URL: accounts, BILLIONS_SIGNUPS_PER_IP_PER_HOUR: "1000", BILLIONS_SIGNINS_PER_IP_PER_15_MINUTES: "1000", BILLIONS_LINK_REDEMPTIONS_PER_IP_PER_15_MINUTES: "1000", BILLIONS_RESET_REQUESTS_PER_IP_PER_HOUR: "1000" })] : []),
  ],
});
