import { defineConfig, devices } from "@playwright/test";

// Phone-first: every e2e run uses a 360 px wide viewport (design §6).
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3000", ...devices["Pixel 5"], viewport: { width: 360, height: 740 } },
  webServer: { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
