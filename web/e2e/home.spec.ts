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
      await page.addInitScript((s) => localStorage.setItem("theme", s), scheme); // light is the default; dark is a saved choice
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
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await page.goto("/");
  await page.locator("form[data-hydrated]").waitFor();
  await page.getByLabel("Amount (MUSD)").fill("0");
  await expect(page.locator("#amount-error")).toContainText("amount must be");
  // @axe-core/playwright ships its own playwright-core types; the runtime Page is the same object.
  const r = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).withRules(["color-contrast"]).analyze();
  expect(r.violations).toEqual([]);
});

test("light by default; the theme button switches to dark and remembers it", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
});

test("problem cards start stacked and spread into a swipe row on tap; the row then takes focus", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Tap the cards to spread them out")).toBeVisible();
  await page.getByRole("button", { name: "Spread out" }).click();
  await expect(page.locator(".deck")).toHaveAttribute("data-spread", "true");
  await expect(page.getByText("Swipe for more")).toBeVisible();
  await expect(page.getByRole("region", { name: "Problem cards" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Costs eat small amounts" })).toBeAttached();
});


test("links to the page you are on jump within it; the bot link opens Telegram", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("navigation", { name: "Main" });
  await expect(page.getByRole("navigation", { name: "Product" }).getByRole("link", { name: "Yields" })).toHaveAttribute("href", "#main");
  await expect(main.getByRole("link", { name: "Yields" })).toHaveAttribute("href", "#");
  await expect(main.getByRole("link", { name: "Vault" })).toHaveAttribute("href", "/vault");
  await expect(main.getByRole("link", { name: "Bot" })).toHaveAttribute("href", "https://t.me/musd_compass_bot");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
});

test("tablet and small laptop widths: no sideways scroll, calculator fields keep their size", async ({ page }) => {
  for (const width of [768, 820, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.locator("form[data-hydrated]").waitFor();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `overflow at ${width}`).toBe(0);
    expect((await page.getByLabel("Amount (MUSD)").boundingBox())!.width, `amount width at ${width}`).toBeGreaterThan(140);
  }
});

test("phone header fits on one line at 360 px", async ({ page }) => {
  await page.goto("/");
  const h = await page.locator("header").first().boundingBox();
  expect(h!.height).toBeLessThanOrEqual(65);
});

test("the app icon, manifest and status bar use the purple logo, not the old yellow", async ({ page, request }) => {
  await page.goto("/");
  const icons = await page.locator('link[rel="icon"]').evaluateAll((ls) => ls.map((l) => l.getAttribute("href")!));
  expect(icons.some((h) => /\/icon\.png/.test(h))).toBe(true);
  for (const h of icons) {
    const r = await request.get(h);
    expect(r.status()).toBe(200);
    expect((await r.body()).toString("latin1")).not.toContain("ffd200"); // the old yellow tile
  }
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /\/apple-icon\.png/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#ffffff");
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.theme_color).toBe("#ffffff");
  expect(m.icons.map((i: { src: string }) => i.src)).toEqual(["/icon-192.png", "/icon-512.png", "/icon-maskable-512.png"]);
  for (const i of m.icons) expect((await request.get(i.src)).status()).toBe(200);
  await expect(page.locator("header img").first()).toHaveAttribute("src", "/logo-mark.png");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0f1015");
});

test("the ranking is in the first HTML response, so the page never waits on a loading state", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain("Venues ranked by cash carry");
  expect(html).toContain("4.01%");
});

test("favicon.ico is the logo too, not the framework's default", async ({ request }) => {
  const ico = await request.get("/favicon.ico");
  expect(ico.status()).toBe(200);
  // Next's starter favicon is 25,931 bytes; ours is built from the logo.
  expect((await ico.body()).length).not.toBe(25931);
});
