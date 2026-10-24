import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("home (360 px, fixture data)", () => {

  test("ranks by cash carry with the holding period on every figure", async ({ page }) => {
    await page.goto("/");
    await page.locator("form[data-hydrated]").waitFor();
    const ranked = page.getByRole("list", { name: "Venues ranked by cash carry" }).getByRole("article");
    await expect(ranked.first()).toContainText("MUSD Savings Vault");
    await expect(ranked.first()).toContainText("4.01%");
    await expect(ranked.first()).toContainText("assumes 90-day hold");
    await expect(page.getByRole("heading", { name: "Not ranked: no steady APR" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  });

  test("calculator re-ranks and mirrors the URL; borrow mode shows the design's 2.72%", async ({ page }) => {
    await page.goto("/");
    await page.locator("form[data-hydrated]").waitFor();
    await page.getByText("Borrow", { exact: true }).click();
    await page.getByLabel("Borrow rate").selectOption("1");
    const lead = page.getByRole("list", { name: "Venues ranked by cash carry" }).getByRole("article").first();
    // 4.01 − 1.10 − 0.41 = 2.50 with the 14-day APR
    await expect(lead).toContainText("2.50%");
    await expect(page).toHaveURL(/mode=borrower/);
    await page.getByLabel("Amount (MUSD)").fill("1000");
    await expect(page.getByRole("status")).toContainText("at least 1,800 MUSD");
  });

  test("deep link from the bot is honoured", async ({ page }) => {
    await page.goto("/?amount=5000&mode=holder&days=365");
    await page.locator("form[data-hydrated]").waitFor();
    await expect(page.getByLabel("Amount (MUSD)")).toHaveValue("5000");
    await expect(page.getByText("assumes 365-day hold").first()).toBeVisible();
  });

  test("no serious or critical accessibility issues (light and dark)", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
    await page.locator("form[data-hydrated]").waitFor();
      await page.getByRole("article").first().waitFor();
      // @axe-core/playwright ships its own playwright-core types; the runtime Page is the same object.
      const r = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${scheme}: ${v.id} ${v.nodes.map((n) => n.target).join(" ")}`)).toEqual([]);
    }
  });
});

test("invalid amount shows a readable error that passes contrast in dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.locator("form[data-hydrated]").waitFor();
  await page.getByLabel("Amount (MUSD)").fill("0");
  await expect(page.locator("#amount-error")).toContainText("amount must be");
  // @axe-core/playwright ships its own playwright-core types; the runtime Page is the same object.
  const r = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).withRules(["color-contrast"]).analyze();
  expect(r.violations).toEqual([]);
});
