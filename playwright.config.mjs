import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  workers: 2,
  use: {
    baseURL: "http://127.0.0.1:4178",
    browserName: "chromium",
    launchOptions: process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {},
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tools/serve.mjs",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: !process.env.CI,
  },
});
