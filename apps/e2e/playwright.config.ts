import { defineConfig, devices } from "@playwright/test";
import { WEB_URL } from "./stack.js";

export default defineConfig({
  testDir: "tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  globalSetup: "./global-setup.ts",
  use: { baseURL: WEB_URL, trace: "retain-on-failure", locale: "es-AR" },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
});
