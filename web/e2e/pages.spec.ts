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
  await expect(page.getByText("per 1,000 calls").first()).toBeVisible();
  await expect(page.locator('main a[href="/stats"]')).toBeVisible();
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

test("trove link from an alert opens that trove", async ({ page }) => {
  await page.goto("/trove?address=0x593c000000000000000000000000000000005bb5");
  await expect(page.getByText("333%", { exact: true })).toBeVisible();
});

test("trove planner: sample → ratio, safe borrow, queue; 'Use in calculator' opens existing-trove mode at its rate", async ({ page }) => {
  await page.goto("/?mode=borrower&trove=existing");
  await page.locator("[data-hydrated]").waitFor();
  await page.getByRole("link", { name: "Read your trove's rate and safe extra borrow" }).click();
  await expect(page).toHaveURL(/\/trove$/);
  await page.getByRole("button", { name: "Try a sample" }).click();
  await expect(page.getByText("333%", { exact: true })).toBeVisible(); // exact: the advice sentence also says "At 333%"
  await expect(page.getByText("20,068 MUSD")).toBeVisible();
  await expect(page.getByText("≈ 812 of 1,204 troves are redeemed before yours")).toBeVisible();
  // The redemption floor is always stated, with both prices, whether or not redeeming pays.
  await expect(page.getByText("MUSD trades at $0.9951 on Mezo's MUSD/mUSDC pool. The redemption floor is $0.9925 (1 minus the 0.75% redemption fee), so redeeming MUSD for BTC does not pay right now.")).toBeVisible();
  // What-if needs no wallet: (1.25 + 0.5) BTC × $80,478 ÷ 30,210.4 MUSD = 466%.
  await page.getByRole("button", { name: "Show the result" }).click();
  await expect(page.getByText("Type an amount of BTC to add or MUSD to repay.")).toBeVisible();
  await page.getByLabel("Add BTC").fill("0.5");
  await page.getByRole("button", { name: "Show the result" }).click();
  await expect(page.getByText("Ratio after: 466% (now 333%).")).toBeVisible();
  await page.getByLabel("Add BTC").fill("abc");
  await page.getByRole("button", { name: "Show the result" }).click();
  await expect(page.getByRole("status").filter({ hasText: /./ })).toHaveClass(/text-danger-text/);
  await expect(page.getByRole("list", { name: "What to do about this trove" }).getByText("BTC would have to fall about 67%")).toBeVisible();
  await expect(page.getByText("Your ratio is comfortable")).toBeVisible();
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

for (const path of ["/get-test-musd", "/developers", "/rewards", "/trove", "/incentives", "/my"]) {
  test(`${path}: no serious or critical accessibility issues (light and dark)`, async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.addInitScript((s) => localStorage.setItem("theme", s), scheme); // light is the default; dark is a saved choice
      await page.goto(path);
      if (path === "/rewards" || path === "/trove") {
        await page.getByRole("button", { name: "Try a sample" }).click();
        await page.getByText(path === "/rewards" ? "239.28" : "333%", { exact: true }).waitFor();
      }
      const bad = (await axe(page)).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    }
  });
}

test("Have BTC? turns on borrowing and says in one line whether minting MUSD to earn pays", async ({ page }) => {
  await page.goto("/");
  await page.locator("form[data-hydrated]").waitFor();
  await expect(page.getByTestId("mint-line")).toHaveCount(0);
  await page.getByRole("button", { name: "Have BTC? See if borrowing MUSD pays" }).click();
  await expect(page).toHaveURL(/mode=borrower/);
  // The fixture's best is staked sMUSD at 57.90%: 57.90 − 1.10 interest − 0.41 fee = 56.40% → about 1,127 MUSD a year on 2,000
  await expect(page.getByTestId("mint-line")).toHaveText(/^Borrow 2,000 MUSD against your BTC at 1%: MUSD Savings Vault, staked in the gauge pays 57\.90%\. After the fee and interest you keep 56\.40% a year, about 1,127 MUSD\.$/);
  await expect(page.getByRole("button", { name: /Have BTC/ })).toHaveCount(0);
});

test("every ranked venue says what this amount keeps before you go in", async ({ page }) => {
  await page.goto("/");
  await page.locator("form[data-hydrated]").waitFor();
  const cards = page.getByRole("list", { name: "Venues ranked by cash carry" }).getByRole("article");
  await expect(cards.first()).toContainText("Before you go in: 2,000 MUSD for 90 days");
  await expect(cards.first()).toContainText(/you keep about \d+\.\d\d MUSD after costs, earned as MEZO, no one-off costs/); // the fixture's top venue is the MEZO-paid gauge
  // Ethereum rows carry the bridge round trip as a one-off cost (the fixture's ranked Mezo gauge pool has none, so pick the Ethereum row).
  await expect(cards.filter({ hasText: "Ethereum" }).first()).toContainText(/MUSD one-off costs, (never earned back|earned back after \d+ days)/);
});

test("My MUSD: each holding against the best place, plus trove and veMEZO; reachable from home; accessible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Already hold MUSD? See where it sits" }).click();
  await expect(page).toHaveURL(/\/my$/);
  await page.getByRole("button", { name: "Try a sample" }).click();
  const holdings = page.getByRole("region", { name: "Each holding against the best cash place today" });
  const row = (name: string) => holdings.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(row("Idle in your wallet")).toContainText(/1,250 MUSD.*Earns nothing.*more a year/);
  // Mainnet holdings act in the Mezo app, not on the testnet vault page; a build with mainnet writes stakes in Compass.
  if (process.env.MAINNET_E2E === "1") await expect(row("Idle in your wallet").getByRole("link", { name: "Deposit, then stake", exact: true })).toHaveAttribute("href", "/vault?net=mainnet");
  else await expect(row("Idle in your wallet").getByRole("link", { name: /Stake in the Mezo app/ })).toHaveAttribute("href", "https://mezo.org/earn/vaults");
  await expect(row("Savings Vault")).toContainText(/Best now: MUSD Savings Vault, staked in the gauge at .*more a year/);
  await expect(row("Savings Vault, staked in the gauge")).toContainText(/paid in MEZO.*This is the best cash place today\./);
  await expect(row("Stability Pool")).toContainText("No steady APR");
  const places = page.getByRole("region", { name: "Every place 6,050 MUSD could go today" }).getByRole("listitem");
  await expect(page.getByText("Not counting the 1,000 MUSD already staked in the gauge.")).toBeVisible(); // staked MUSD is not moved again
  await expect(places.first()).toContainText(/MUSD Savings Vault, staked in the gauge.*cash.*paid in MEZO/);
  await expect(places.filter({ hasText: "MUSD Savings Vault (sMUSD)" })).toContainText(/4\.23% cash.*about 256 MUSD a year/);
  await expect(page.getByText("Higher rates, but they need BTC or MEZO too")).toBeVisible();
  await expect(places.filter({ hasText: "Ethereum" }).first()).toContainText("locked veMEZO, not counted");
  await expect(page.getByText(/30,210 MUSD borrowed at 1%/)).toBeVisible();
  await expect(page.getByText(/239\.28 veMEZO waiting/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  const bad = (await axe(page)).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => v.id)).toEqual([]);
});

test("trove API: the fixture response carries advice", async ({ request }) => {
  const body = await (await request.get("/api/trove/sample")).json();
  expect(body.advice.length).toBeGreaterThan(0);
  expect(body.advice[0]).toEqual(expect.objectContaining({ level: expect.stringMatching(/^(ok|watch|act)$/), title: expect.any(String), detail: expect.any(String) }));
});

test("stats: heading, not-switched-on state under fixtures, second-wallet tx link, no horizontal scroll, accessible; footer link on home", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const scheme of ["light", "dark"] as const) {
    await page.addInitScript((s) => localStorage.setItem("theme", s), scheme);
    await page.goto("/stats");
    await expect(page.getByRole("heading", { level: 1, name: "Usage stats" })).toBeVisible();
    await expect(page.getByText("Counting is not switched on in this deployment yet")).toBeVisible();
    await expect(page.getByText("not counted yet")).toBeVisible();
    await expect(page.getByRole("link", { name: /Paid from a second wallet/ })).toHaveAttribute(
      "href",
      "https://explorer.test.mezo.org/tx/0x3a63cdf86569c3787867fcc9ddb3ebf8c91eb8dec1a2a206c716457f8c30bc5a",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    const bad = (await axe(page)).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${scheme}: ${v.id}`)).toEqual([]);
  }
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Usage stats" }).click();
  await expect(page).toHaveURL(/\/stats$/);
});
