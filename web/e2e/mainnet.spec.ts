import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Runs only against a build made with NEXT_PUBLIC_MAINNET_WRITES=1 (the flag is fixed at build time):
//   NEXT_PUBLIC_MAINNET_WRITES=1 COMPASS_FIXTURES=1 npm run build && MAINNET_E2E=1 npx playwright test e2e/mainnet.spec.ts
// The wallet and the Mezo RPC are stand-ins, so no real network is touched and nothing can be sent.
test.skip(process.env.MAINNET_E2E !== "1", "needs a build with mainnet writes switched on");

const ACCOUNT = "0xfe21b2782b35be770dd4a7b05f81ce43790d676c";
const MUSD = "0xdd468a1ddc392dcdbef6db6e34e89aa338f9f186";
const SMUSD = "0xb4d498029af77680cd1ef828b967f010d06c51cc";
const GAUGE = "0x677817bf3e44b90e8f95222f75e2950b7904a401";
const word = (v: bigint | string) => (typeof v === "bigint" ? v.toString(16) : v.replace("0x", "")).padStart(64, "0");
const E18 = 10n ** 18n;

type Sent = { to: string; data: string; value?: string };
const sent = (page: Page) => page.evaluate(() => (window as unknown as { __sent: Sent[] }).__sent);
const asked = (page: Page) => page.evaluate(() => (window as unknown as { __asked: string[] }).__asked);

// An open trove for the RPC stand-in: 0.29 BTC against 20,000 MUSD at $80,000 is 116%.
const TROVE_WORDS: Record<string, string> = {
  "0x21e37801": word(1n), // getTroveStatus: active
  "0xb91af97c": [29n * 10n ** 16n, 20_000n * E18, 0n, 0n, 0n, 0n].map(word).join(""), // getEntireDebtAndColl
  "0xd293c710": word(116n * 10n ** 16n), // getCurrentICR: 1.16
  "0x92b7659b": word(100n), // getTroveInterestRate: 1%
  "0xb0d8e181": word(145n * 10n ** 16n), // getNominalICR
  "0x4e443d9e": word(0n), // checkRecoveryMode: no
};

async function setUp(page: Page, { trove = false } = {}) {
  // A wallet that connects, switches chain when asked, and records every transaction instead of sending it.
  await page.addInitScript((account) => {
    const w = window as unknown as { __sent: unknown[]; __asked: string[] };
    w.__sent = [];
    w.__asked = [];
    let chain = "0x7b7b"; // starts on Mezo testnet (31611)
    const provider = {
      request: async ({ method, params }: { method: string; params?: unknown[] }) => {
        w.__asked.push(method);
        if (method === "eth_requestAccounts" || method === "eth_accounts") return [account];
        if (method === "eth_chainId") return chain;
        if (method === "wallet_switchEthereumChain") {
          chain = (params as { chainId: string }[])[0].chainId;
          return null;
        }
        if (method === "eth_sendTransaction") {
          w.__sent.push((params as unknown[])[0]);
          return `0x${String(w.__sent.length).padStart(64, "0")}`;
        }
        throw Object.assign(new Error(`unexpected ${method}`), { code: 4200 });
      },
    };
    window.addEventListener("eip6963:requestProvider", () =>
      window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: { uuid: "m1", name: "Test Wallet", icon: "", rdns: "test.wallet" }, provider }) })),
    );
  }, ACCOUNT);

  // Mezo mainnet RPC stand-in: enough for the page's reads, the simulation, the gas estimate and the receipt.
  let block = 100;
  const answer = (c: { method: string; params: { data?: string }[] }) => {
    switch (c.method) {
      case "eth_chainId": return "0x7b7c";
      case "eth_blockNumber": return `0x${(++block).toString(16)}`;
      case "eth_getBalance": return `0x${E18.toString(16)}`;
      case "eth_estimateGas": return "0x186a0";
      case "eth_getTransactionReceipt": return { status: "0x1", blockNumber: "0x64", blockHash: `0x${word(1n)}`, transactionHash: (c.params as unknown as string[])[0], transactionIndex: "0x0", from: ACCOUNT, to: MUSD, cumulativeGasUsed: "0x1", gasUsed: "0x1", effectiveGasPrice: "0x1", contractAddress: null, logs: [], logsBloom: `0x${"0".repeat(512)}`, type: "0x0" };
      case "eth_call": {
        const sel = c.params[0].data?.slice(0, 10);
        if (sel === "0x0fdb11cf") return `0x${word(80_000n * E18)}`; // fetchPrice
        if (sel === "0x969c2452") return `0x${word(1_800n * E18)}`; // minNetDebt
        if (sel === "0xb5b8453e") return `0x${word(10n ** 15n)}`; // borrowingRate
        if (sel === "0x7af110ba") return `0x${word(200n * E18)}`; // gas compensation
        if (trove && sel && TROVE_WORDS[sel]) return `0x${TROVE_WORDS[sel]}`;
        if (sel === "0x21e37801") return `0x${word(0n)}`; // getTroveStatus: none
        if (sel === "0x70a08231") return `0x${word(500n * E18)}`; // balanceOf (MUSD, sMUSD, gauge): 500
        if (sel === "0xdd62ed3e") return `0x${word(0n)}`; // allowance: none
        return `0x${word(1n)}`;
      }
      default: return null;
    }
  };
  await page.route("https://rpc-http.mezo.boar.network/**", async (route) => {
    const body = route.request().postDataJSON();
    const one = (c: { id: number; method: string; params: { data?: string }[] }) => ({ jsonrpc: "2.0", id: c.id, result: answer(c) });
    await route.fulfill({ json: Array.isArray(body) ? body.map(one) : one(body) });
  });
}

// The vault read as /api/vault answers on mainnet, with sMUSD in the wallet and some staked in the gauge.
const mockVault = (page: Page, gauge: { staked: string | null; earnedMezo: string | null } = { staked: "200", earnedMezo: "12.5" }) =>
  page.route("**/api/vault/*", (route) => {
    const address = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop()!);
    return route.fulfill({ json: { address, musd: "157.31", allowance: "0", smusd: "500", pendingYield: "0", lastDistribution: 1792675011, lastDistributionPending: false, network: "Mezo mainnet", ...gauge } });
  });

// Compass's trove API for the account: the redemption queue, the MUSD price and, when asked, the after-preview.
const TROVE_API = { address: ACCOUNT, active: true, collateralBtc: 0.29, collateralUsd: 23_200, debt: 20_000, icrPct: 116, ratePct: 1, ahead: 0, troves: 4, recoveryMode: false, safeExtra: 0, btcUsd: 80_000, nicr: "1450000000000000000", safeIcrPct: 200, minIcrPct: 110, network: "Mezo mainnet" };
const mockTroveApi = (page: Page, extra: Record<string, unknown>) => page.route("**/api/trove/*", (route) => route.fulfill({ json: { ...TROVE_API, ...extra } }));

async function connectOnMainnet(page: Page, opts: { trove?: boolean } = {}) {
  await setUp(page, opts);
  await page.goto("/vault?net=mainnet");
  await expect(page.getByRole("radio", { name: "Mezo mainnet (real funds)" })).toBeChecked();
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await page.getByRole("dialog", { name: "Connect a wallet" }).getByRole("button", { name: /Test Wallet/ }).click();
  await expect(page.getByText("on Mezo mainnet.")).toBeVisible();
  await expect(page.getByText("157.31")).toBeVisible();
}

test("mainnet is named everywhere before anything can be sent, and the wallet is moved to chain 31612", async ({ page }) => {
  await connectOnMainnet(page);
  await expect(page.getByRole("note").filter({ hasText: "Mezo mainnet: real funds" })).toContainText("stop at 2,500 MUSD");
  await expect(page.getByRole("heading", { name: "Savings Vault position on Mezo mainnet" })).toBeVisible();
  await expect(page.getByText("Need test funds?")).toHaveCount(0);
  expect(await asked(page)).toContain("wallet_switchEthereumChain");
  expect(await sent(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  const r = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  if (process.env.MAINNET_SHOT) await page.screenshot({ path: process.env.MAINNET_SHOT, fullPage: true });
});

test("a mainnet deposit sends nothing until the amount is typed, then approves exactly that amount and deposits it", async ({ page }) => {
  await connectOnMainnet(page);
  await page.getByLabel("Deposit MUSD").fill("100");
  await page.getByRole("button", { name: "Deposit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Mezo mainnet: real funds" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Moves 100 MUSD from your wallet into the Mezo Savings Vault.");
  const go = dialog.getByRole("button", { name: "Deposit on mainnet" });
  await expect(go).toBeDisabled();
  await dialog.getByLabel("Type 100 to confirm").fill("99");
  await expect(go).toBeDisabled();
  expect(await sent(page)).toEqual([]);
  await dialog.getByLabel("Type 100 to confirm").fill("100");
  await go.click();
  await expect(page.getByText("Confirmed")).toHaveCount(2);
  const txs = await sent(page);
  expect(txs).toHaveLength(2);
  expect(txs[0].to.toLowerCase()).toBe(MUSD);
  expect(txs[0].data).toBe(`0x095ea7b3${word(SMUSD)}${word(100n * E18)}`); // approve(vault, exactly 100 MUSD)
  expect(txs[1].to.toLowerCase()).toBe(SMUSD);
  expect(txs[1].data).toBe(`0xb6b55f25${word(100n * E18)}`); // deposit(100 MUSD)
  expect(txs.every((t) => !t.value || BigInt(t.value) === 0n)).toBe(true);
});

test("cancelling the mainnet dialog sends nothing", async ({ page }) => {
  await connectOnMainnet(page);
  await page.getByLabel("Deposit MUSD").fill("50");
  await page.getByRole("button", { name: "Deposit", exact: true }).click();
  await page.getByRole("dialog", { name: "Mezo mainnet: real funds" }).getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Mezo mainnet: real funds" })).toBeHidden();
  expect(await sent(page)).toEqual([]);
});

test("a deposit and a new trove above 2,500 MUSD cannot be started on mainnet", async ({ page }) => {
  await connectOnMainnet(page);
  await page.getByLabel("Deposit MUSD").fill("3000");
  await expect(page.getByText("Compass deposits at most 2,500 MUSD per transaction on mainnet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Deposit", exact: true })).toBeDisabled();
  await page.getByLabel(/Borrow \(MUSD/).fill("2600");
  await expect(page.getByText("Compass opens troves of at most 2,500 MUSD on mainnet.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Borrow 2600 MUSD and deposit it/ })).toBeDisabled();
  expect(await sent(page)).toEqual([]);
});

test("switching back to testnet clears the mainnet numbers and the warning", async ({ page }) => {
  await connectOnMainnet(page);
  await page.getByRole("radio", { name: "Mezo testnet (test funds)" }).check();
  await expect(page.getByText("on Mezo testnet.")).toBeVisible();
  await expect(page.getByRole("note").filter({ hasText: "Mezo mainnet: real funds" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Savings Vault position on Mezo testnet" })).toBeVisible();
});

test("the home page and the trove page point at the mainnet vault", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Can I use real funds here?")).toBeVisible();
  await page.goto("/trove");
  await page.getByRole("button", { name: "Try a sample" }).click();
  await expect(page.getByRole("link", { name: "Add BTC or repay MUSD here in Compass" })).toHaveAttribute("href", "/vault?net=mainnet");
  await expect(page.getByText("Do it in the Mezo app.")).toHaveCount(0); // the advice must not send people away from what Compass can now do
});

test.describe("gauge staking (mocked vault read: 500 sMUSD in the wallet, 200 staked, 12.5 MEZO to claim)", () => {
  test.beforeEach(async ({ page }) => {
    await mockVault(page);
    await connectOnMainnet(page);
    await expect(page.getByRole("heading", { name: "Stake in Mezo's gauge to earn MEZO" })).toBeVisible();
    await expect(page.getByText("Staked: 200 sMUSD. MEZO to claim: 12.5.")).toBeVisible();
  });

  test("stake 100 sends nothing until the amount is typed, then approves exactly 100 sMUSD for the gauge and stakes it", async ({ page }) => {
    await page.getByLabel("Stake sMUSD", { exact: true }).fill("100");
    await page.getByRole("button", { name: "Stake", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Mezo mainnet: real funds" });
    await expect(dialog).toContainText("Moves 100 sMUSD from your wallet into Mezo's Savings Vault gauge.");
    await expect(dialog).toContainText("Two wallet prompts");
    await expect(dialog).toContainText("stops earning the vault's fee yield");
    const go = dialog.getByRole("button", { name: "Stake on mainnet" });
    await expect(go).toBeDisabled();
    expect(await sent(page)).toEqual([]);
    await dialog.getByLabel("Type 100 to confirm").fill("100");
    await go.click();
    await expect(page.getByText("Confirmed")).toHaveCount(2);
    const txs = await sent(page);
    expect(txs).toHaveLength(2);
    expect(txs[0].to.toLowerCase()).toBe(SMUSD);
    expect(txs[0].data).toBe(`0x095ea7b3${word(GAUGE)}${word(100n * E18)}`); // approve(gauge, exactly 100 sMUSD)
    expect(txs[1].to.toLowerCase()).toBe(GAUGE);
    expect(txs[1].data).toBe(`0xb6b55f25${word(100n * E18)}`); // deposit(100 sMUSD)
  });

  test("unstake 50 sends one withdraw, only after the typed confirmation", async ({ page }) => {
    await page.getByLabel("Unstake sMUSD").fill("50");
    await page.getByRole("button", { name: "Unstake", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Mezo mainnet: real funds" });
    await dialog.getByLabel("Type 50 to confirm").fill("5");
    await expect(dialog.getByRole("button", { name: "Unstake on mainnet" })).toBeDisabled();
    expect(await sent(page)).toEqual([]);
    await dialog.getByLabel("Type 50 to confirm").fill("50");
    await dialog.getByRole("button", { name: "Unstake on mainnet" }).click();
    await expect(page.getByText("Confirmed")).toHaveCount(1);
    const txs = await sent(page);
    expect(txs).toHaveLength(1);
    expect(txs[0].to.toLowerCase()).toBe(GAUGE);
    expect(txs[0].data).toBe(`0x2e1a7d4d${word(50n * E18)}`); // withdraw(50 sMUSD)
  });

  test("Claim MEZO sends getReward for the connected account", async ({ page }) => {
    await page.getByRole("button", { name: "Claim MEZO" }).click();
    await expect(page.getByText("Confirmed")).toHaveCount(1);
    const txs = await sent(page);
    expect(txs).toHaveLength(1);
    expect(txs[0].to.toLowerCase()).toBe(GAUGE);
    expect(txs[0].data).toBe(`0xc00007b0${word(ACCOUNT)}`); // getReward(account)
  });

  test("a stake over the cap or over the wallet's sMUSD cannot be started", async ({ page }) => {
    const button = page.getByRole("button", { name: "Stake", exact: true });
    await page.getByLabel("Stake sMUSD", { exact: true }).fill("3000");
    await expect(page.getByText("Compass stakes at most 2,500 sMUSD per transaction on mainnet.")).toBeVisible();
    await expect(button).toBeDisabled();
    await page.getByLabel("Stake sMUSD", { exact: true }).fill("600");
    await expect(page.getByText("More than your wallet holds (500 sMUSD).")).toBeVisible();
    await expect(button).toBeDisabled();
    expect(await sent(page)).toEqual([]);
  });

  test("the section is accessible, fits 360 px, and is gone on testnet", async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
    const r = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    await page.getByRole("radio", { name: "Mezo testnet (test funds)" }).check();
    await expect(page.getByText("on Mezo testnet.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stake in Mezo's gauge to earn MEZO" })).toHaveCount(0);
  });
});

test("a gauge read that failed says so and turns the gauge controls off", async ({ page }) => {
  await mockVault(page, { staked: null, earnedMezo: null });
  await connectOnMainnet(page);
  await expect(page.getByText("Could not read the gauge right now.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim MEZO" })).toBeDisabled();
  await expect(page.getByLabel("Stake sMUSD", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Unstake sMUSD")).toBeDisabled();
});

test("the top-up dialog shows the ratio and the redemption line before and after, and still works when Compass does not answer", async ({ page }) => {
  await mockTroveApi(page, { market: { musdUsd: 0.9924, floorUsd: 0.9925, redemptionPct: 0.75 }, preview: { icrPct: 150, collateralBtc: 0.5, debt: 20_000, ahead: 1, troves: 4 } });
  await connectOnMainnet(page, { trove: true });
  await expect(page.getByRole("heading", { name: "Your mainnet trove" })).toBeVisible();
  // The queue and the MUSD price from Compass's trove API reach the advice.
  await expect(page.getByText("MUSD is below the redemption floor")).toBeVisible();
  await expect(page.getByText("0 of 4 troves would be redeemed before yours.")).toBeVisible();
  await expect(page.getByText("Your trove is first in line for redemptions")).toHaveCount(0); // the pressure warning says it already
  await page.getByLabel("Add BTC to the trove").fill("0.1");
  await expect(page.getByText("Ratio after: 156% (now 116%).")).toBeVisible(); // (0.29 + 0.1) × 80,000 ÷ 20,000
  await page.getByRole("button", { name: "Add BTC", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Mezo mainnet: real funds" });
  await expect(dialog).toContainText("Your ratio goes from 116% to 156%. Troves redeemed before yours: about 0 now, about 1 after, of 4.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  // Compass unreachable: the dialog falls back to the local ratio, and the action is still offered.
  await page.unroute("**/api/trove/*");
  await page.route("**/api/trove/*", (route) => route.abort());
  await page.getByRole("button", { name: "Add BTC", exact: true }).click();
  await expect(dialog).toContainText("Your ratio goes from 116% to 156%.");
  await expect(dialog).not.toContainText("Troves redeemed before yours");
  await expect(dialog.getByRole("button", { name: "Add on mainnet" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.getByLabel("Repay MUSD").fill("4000");
  await expect(page.getByText("Ratio after: 145% (now 116%).")).toBeVisible(); // 0.29 × 80,000 ÷ 16,000
  expect(await sent(page)).toEqual([]);
});

for (const [musdUsd, shows] of [[0.9924, true], [0.9951, false]] as const) {
  test(`the Borrow → Earn dialog ${shows ? "warns" : "does not warn"} about redemptions when MUSD is at $${musdUsd}`, async ({ page }) => {
    await mockTroveApi(page, { active: false, market: { musdUsd, floorUsd: 0.9925, redemptionPct: 0.75 } });
    await connectOnMainnet(page);
    await page.getByRole("button", { name: /Borrow 2000 MUSD and deposit it/ }).click();
    const dialog = page.getByRole("dialog", { name: "Mezo mainnet: real funds" });
    await expect(dialog).toContainText("Locks");
    const line = "MUSD trades at $0.9924, under the $0.9925 redemption floor, so redeeming MUSD for BTC pays right now. Redemptions start with the lowest-ratio troves, and a new trove at 200% can be reached once the troves below it are used up.";
    if (shows) await expect(dialog).toContainText(line);
    else await expect(dialog).not.toContainText("redemption floor");
    expect(await sent(page)).toEqual([]);
  });
}
