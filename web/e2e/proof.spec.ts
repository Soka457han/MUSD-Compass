import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const axe = (page: Parameters<Parameters<typeof test>[2]>[0]["page"]) =>
  new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).analyze();

test("proof: heading, 9 mainnet and 14 testnet explorer links, no horizontal scroll, accessible; footer link on home", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const scheme of ["light", "dark"] as const) {
    await page.addInitScript((s) => localStorage.setItem("theme", s), scheme);
    await page.goto("/proof");
    await expect(page.getByRole("heading", { level: 1, name: "Proof: every transaction Compass has sent" })).toBeVisible();
    const main = page.getByRole("list", { name: "Mainnet transactions" }).getByRole("link");
    await expect(main).toHaveCount(9);
    for (const a of await main.all()) await expect(a).toHaveAttribute("href", /^https:\/\/explorer\.mezo\.org\/tx\/0x[0-9a-f]{64}$/);
    const links = page.getByRole("list", { name: "Testnet transactions" }).getByRole("link");
    await expect(links).toHaveCount(14);
    for (const a of await links.all()) await expect(a).toHaveAttribute("href", /^https:\/\/explorer\.test\.mezo\.org\/tx\/0x[0-9a-f]{64}$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    const bad = (await axe(page)).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${scheme}: ${v.id}`)).toEqual([]);
  }
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Proof" }).click();
  await expect(page).toHaveURL(/\/proof$/);
});
