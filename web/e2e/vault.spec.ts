import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("vault (360 px, fixture data)", () => {
  test("says it is testnet, works without a wallet, and the sample shows a position", async ({ page }) => {
    await page.goto("/vault");
    await expect(page.getByRole("note")).toContainText("Testnet action");
    await expect(page.getByText("No wallet in this browser")).toBeVisible();
    await page.getByRole("button", { name: "Try a sample" }).click();
    await expect(page.getByText("157.31")).toBeVisible();
    await expect(page.getByText(/Pending yield is 0 until the next distribution/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  });

  test("a bad address gets a readable error", async ({ page }) => {
    await page.goto("/vault");
    await page.getByLabel("Address").fill("0x123");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "not an EVM address" })).toBeVisible();
  });

  test("no serious or critical accessibility issues (light and dark)", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/vault");
      await page.getByRole("button", { name: "Try a sample" }).click();
      await page.getByText("157.31").waitFor();
      // @axe-core/playwright ships its own playwright-core types; the runtime Page is the same object.
      const r = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).analyze();
      const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${scheme}: ${v.id} ${v.nodes.map((n) => n.target).join(" ")}`)).toEqual([]);
    }
  });
});
