import { defineConfig, devices } from "@playwright/test";

// Phone-first: every e2e run uses a 360 px wide viewport (design §6).
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  // Reduced motion: cards entering the screen are dimmed on purpose while they scroll in, and the contrast checks should measure the settled page.
  use: { baseURL: "http://localhost:3000", ...devices["Pixel 5"], viewport: { width: 360, height: 740 }, contextOptions: { reducedMotion: "reduce" } },
  // Fixture data (live samples recorded 24 Oct) keeps e2e deterministic and offline.
  webServer: { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: !process.env.CI, timeout: 120_000, env: { COMPASS_FIXTURES: "1" } },
});
