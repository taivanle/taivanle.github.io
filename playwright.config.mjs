import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  workers: 2,
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:4178",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          ...(process.env.CHROME_PATH
            ? { executablePath: process.env.CHROME_PATH }
            : {}),
        },
      },
    },
    {
      name: "webkit",
      testMatch: [
        /navigation\.spec\.mjs/,
        /flash-regression\.spec\.mjs/,
        /chapter-return\.spec\.mjs/,
      ],
      use: { browserName: "webkit" },
    },
  ],
  webServer: {
    command: "node tools/serve.mjs",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: !process.env.CI,
  },
});
