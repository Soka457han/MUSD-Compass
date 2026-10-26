import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The test serves Compass from localhost; Chromium blocks a public page from loading localhost
// resources (Local Network Access). Real sites load embed.js from the public Vercel URL, so this is test-only.
test.use({ launchOptions: { args: ["--disable-features=LocalNetworkAccessChecks"] } });

test("one script tag on another page shows the top 3 by cash carry", async ({ page }) => {
  // A stand-in for a third-party page: only the documented tag, nothing else from Compass.
  await page.route("http://host.example/", (r) =>
    r.fulfill({ contentType: "text/html", body: '<!doctype html><h1>Someone else\'s site</h1><script src="http://localhost:3000/embed.js" data-amount="5000" async></script>' }),
  );
  await page.goto("http://host.example/");
  const frame = page.frameLocator('iframe[title^="MUSD Compass"]');
  await expect(frame.getByText("Cash carry per year on 5,000 MUSD")).toBeVisible();
  await expect(frame.getByRole("listitem")).toHaveCount(3);
  await expect(frame.getByRole("listitem").first()).toContainText("Savings Vault");
  await expect(frame.getByText("Mainnet data · assumes 90-day hold")).toBeVisible();
  await expect(frame.getByRole("link", { name: /Full table/ })).toHaveAttribute("href", "/?amount=5000&mode=holder&days=90");
  // Everything fits inside the fixed-height iframe, no scrolling inside it.
  const overflow = await page.frames()[1].evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("widget has no serious or critical accessibility issues (light and dark)", async ({ page }) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.addInitScript((s) => localStorage.setItem("theme", s), scheme); // dark is the default; light is a saved choice
    await page.goto("/embed");
    await page.getByText("Full table").waitFor();
    const r = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  }
});
