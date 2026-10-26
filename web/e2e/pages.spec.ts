import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const axe = (page: Parameters<Parameters<typeof test>[2]>[0]["page"]) =>
  // @axe-core/playwright ships its own playwright-core types; the runtime Page is the same object.
  new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).analyze();

test("get-test-musd: 3 steps, faucet link, no horizontal scroll, ends at a deposit", async ({ page }) => {
  await page.goto("/get-test-musd");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(3);
  await expect(page.getByRole("link", { name: /Mezo testnet faucet/ })).toHaveAttribute("href", "https://faucet.test.mezo.org");
  await expect(page.getByText("31611")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  await page.getByRole("link", { name: "Deposit 100 MUSD in the Savings Vault" }).click();
  await expect(page).toHaveURL(/\/vault\?action=deposit&amount=100/);
});

test("developers: documents the endpoints with curl examples; nav API goes here", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "API" }).click();
  await expect(page).toHaveURL(/\/developers$/);
  for (const h of ["GET /api/yields", "GET /api/vault/{address}", "GET /api/health", "Widget for any website", "Telegram bot"]) {
    await expect(page.getByRole("heading", { name: h })).toBeVisible();
  }
  await expect(page.getByLabel("Example: yields request")).toContainText('curl "https://musd-compass.vercel.app/api/yields?amount=2000');
  await expect(page.getByRole("heading", { name: /GET \/api\/premium\/yields/ })).toBeVisible();
  await page.getByRole("button", { name: "Pay 0.001 MUSD & fetch" }).click(); // no wallet in the test browser
  await expect(page.getByRole("alert").filter({ hasText: "No wallet in this browser" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

test("rewards: the sample shows unclaimed veMEZO, the warning and the reward path; reachable from home", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Check an address for unclaimed veMEZO" }).click();
  await expect(page).toHaveURL(/\/rewards$/);
  await page.getByRole("button", { name: "Try a sample" }).click();
  await expect(page.getByText("239.28")).toBeVisible();
  await expect(page.getByText(/can be reallocated after a campaign ends/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Claim on Merkl/ })).toHaveAttribute("href", "https://app.merkl.xyz");
  await expect(page.getByRole("heading", { name: "Where this reward goes" })).toBeVisible();
  await page.getByLabel("Address").fill("0x123");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "not an EVM address" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

test("trove planner: sample → ratio, safe borrow, queue; 'Use in calculator' opens existing-trove mode at its rate", async ({ page }) => {
  await page.goto("/?mode=borrower&trove=existing");
  await page.locator("[data-hydrated]").waitFor();
  await page.getByRole("link", { name: "Read your trove's rate and safe extra borrow" }).click();
  await expect(page).toHaveURL(/\/trove$/);
  await page.getByRole("button", { name: "Try a sample" }).click();
  await expect(page.getByText("333%")).toBeVisible();
  await expect(page.getByText("20,068 MUSD")).toBeVisible();
  await expect(page.getByText("≈ 812 of 1,204 troves are redeemed before yours")).toBeVisible();
  await page.getByRole("link", { name: "Use in calculator" }).click();
  await expect(page).toHaveURL(/mode=borrower/);
  const url = new URL(page.url());
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ trove: "existing", rate: "1", amount: "20068" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

test("incentives: Mezo-paid campaigns, most efficient first, nested Curve listings not added", async ({ page }) => {
  await page.goto("/incentives");
  const rows = page.getByRole("table").getByRole("row");
  await expect(rows).toHaveCount(3); // header + Curve + Uniswap V4
  await expect(rows.nth(1)).toContainText("Curve MUSD/USDC/USDT");
  await expect(rows.nth(1)).toContainText("$0.13");
  await expect(rows.nth(2)).toContainText("Uniswap V4 USDC/MUSD");
  await expect(rows.nth(2)).toContainText("$1.37");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

for (const path of ["/get-test-musd", "/developers", "/rewards", "/trove", "/incentives"]) {
  test(`${path}: no serious or critical accessibility issues (light and dark)`, async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.addInitScript((s) => localStorage.setItem("theme", s), scheme); // light is the default; dark is a saved choice
      await page.goto(path);
      if (path === "/rewards" || path === "/trove") {
        await page.getByRole("button", { name: "Try a sample" }).click();
        await page.getByText(path === "/rewards" ? "239.28" : "333%").waitFor();
      }
      const bad = (await axe(page)).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    }
  });
}
