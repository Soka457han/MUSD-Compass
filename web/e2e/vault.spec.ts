import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("vault (360 px, fixture data)", () => {
  test("says it is testnet, works without a wallet, and the sample shows a position", async ({ page }) => {
    test.skip(process.env.MAINNET_E2E === "1", "this build has mainnet switched on");
    await page.goto("/vault");
    await expect(page.getByRole("note")).toContainText("Testnet action");
    await expect(page.getByText("No wallet in this browser. Open this page inside")).toBeVisible();
    await page.getByRole("button", { name: "Try a sample" }).click();
    await expect(page.getByText("157.31")).toBeVisible();
    await expect(page.getByText(/Pending yield is 0 until the next distribution/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(0);
  });

  test("with mainnet switched off, ?net=mainnet changes nothing: no network choice, still testnet", async ({ page, request }) => {
    test.skip(process.env.MAINNET_E2E === "1", "this build has mainnet switched on");
    await page.goto("/vault?net=mainnet");
    await expect(page.getByRole("note")).toContainText("Testnet action");
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByText("real funds")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "MUSD Savings Vault on Mezo testnet" })).toBeVisible();
    // The read API names the network it answered for, and refuses one it does not know.
    const a = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C";
    expect((await (await request.get(`/api/vault/${a}`)).json()).network).toBe("Mezo testnet");
    expect((await (await request.get(`/api/vault/${a}?network=mainnet`)).json()).network).toBe("Mezo mainnet");
    expect((await request.get(`/api/vault/${a}?network=ethereum`)).status()).toBe(400);
  });

  test("a bad address gets a readable error", async ({ page }) => {
    await page.goto("/vault");
    await page.getByLabel("Address").fill("0x123");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "not an EVM address" })).toBeVisible();
  });

  test("no serious or critical accessibility issues (light and dark)", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.addInitScript((s) => localStorage.setItem("theme", s), scheme); // light is the default; dark is a saved choice
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

test("Connect wallet opens the wallet picker: detected EVM wallets, what is not available here, and how to close it", async ({ page }) => {
  // A stand-in wallet extension that announces itself the EIP-6963 way.
  await page.addInitScript(() => {
    const provider = { request: async () => { throw Object.assign(new Error("User rejected the request."), { code: 4001 }); } };
    const announce = () =>
      window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: { uuid: "test-1", name: "Test Wallet", icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>", rdns: "test.wallet" }, provider }) }));
    window.addEventListener("eip6963:requestProvider", announce);
  });
  await page.goto("/vault");
  await page.getByRole("button", { name: "Connect wallet" }).click();
  const dialog = page.getByRole("dialog", { name: "Connect a wallet" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Test Wallet/ })).toBeVisible();
  await expect(dialog.getByText("Phone wallets by QR code, not switched on in this deployment")).toBeVisible();
  await expect(dialog.getByText("Bitcoin wallets · view only for now")).toBeVisible();
  await expect(dialog.getByText("Unisat")).toBeVisible();
  await expect(dialog.getByText("Not found in this browser")).toHaveCount(3); // Unisat, OKX, Xverse: none injected here
  await expect(dialog.getByRole("button", { name: /Unisat|WalletConnect/ })).toHaveCount(0); // listed, not clickable
  await expect(dialog.getByRole("heading", { name: "What is a wallet?" })).toBeVisible();
  // Picking the wallet keeps the picker open while the wallet asks; a refusal is explained there, with a retry.
  await dialog.getByRole("button", { name: /Test Wallet/ }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Test Wallet/ })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByText("Test Wallet did not connect")).toBeVisible();
  await expect(dialog.getByText("You cancelled in your wallet. Nothing was sent.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Opening it again starts fresh: the explainer, not the old error.
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(dialog.getByRole("heading", { name: "What is a wallet?" })).toBeVisible();
  await page.keyboard.press("Escape");
  const r = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("while the wallet is asking, the picker says so and waits", async ({ page }) => {
  await page.addInitScript(() => {
    const provider = { request: () => new Promise(() => {}) }; // never answers, like an open extension popup
    window.addEventListener("eip6963:requestProvider", () =>
      window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: { uuid: "t2", name: "Slow Wallet", icon: "", rdns: "slow.wallet" }, provider }) })),
    );
  });
  await page.goto("/vault");
  await page.getByRole("button", { name: "Connect wallet" }).click();
  const dialog = page.getByRole("dialog", { name: "Connect a wallet" });
  await dialog.getByRole("button", { name: /Slow Wallet/ }).click();
  await expect(dialog.getByText("Opening Slow Wallet…")).toBeVisible();
  await expect(dialog.getByText(/Confirm the connection in your wallet/)).toBeVisible();
});

test("Try to break it: unlimited approval and an unknown contract are refused with no wallet", async ({ page }) => {
  await page.goto("/vault");
  const panel = page.getByRole("region", { name: "Try to break it" });
  await panel.getByRole("button", { name: "Ask for an unlimited MUSD approval" }).click();
  await expect(panel.getByText(/Refused before any wallet is asked: Compass never asks for an unlimited approval/)).toBeVisible();
  await panel.getByRole("button", { name: "Send to a contract that is not the vault" }).click();
  await expect(panel.getByText(/Refused before any wallet is asked: Compass only sends to testnet MUSD, sMUSD and BorrowerOperations/)).toBeVisible();
});

test("a Bitcoin wallet (Unisat) shows its Mezo account, view only, with no actions", async ({ page }) => {
  // Stand-in Unisat: a native SegWit address and a 33-byte public key. Nothing can be signed or sent.
  await page.addInitScript(() => {
    (window as unknown as { unisat: unknown }).unisat = {
      requestAccounts: async () => ["bc1qr2gzwarzhv2r2r70v7522w67rt8n6azcklup4z"],
      getPublicKey: async () => "0301c3a0b3e1a18d0e04a455e2fbed97d97352cfc35ad272cdc8dcb0fc8dee6707",
    };
  });
  await page.goto("/vault");
  await page.getByRole("button", { name: "Connect wallet" }).click();
  const dialog = page.getByRole("dialog", { name: "Connect a wallet" });
  await expect(dialog.getByText("Bitcoin wallets · view only for now")).toBeVisible();
  await dialog.getByRole("button", { name: /Unisat/ }).click();
  await expect(dialog).toBeHidden();
  // CREATE2 at the OrangeKit factory for this address's key hash (keyHash vector in tests/unit/bitcoinWallet.test.ts).
  await expect(page.getByLabel("Address")).toHaveValue("0x83120d096814eb9A0E7dfAE4d43ef8C6A9f5c1B2");
  await expect(page.getByText(/Showing the Mezo account of your Bitcoin wallet \(0x8312…c1B2\), view only/)).toBeVisible();
  await expect(page.getByText("157.31")).toBeVisible();
  // The sections show the account's real numbers, but nothing on the page can act for a Bitcoin-wallet account.
  await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();
  await expect(page.getByText("Bitcoin-wallet accounts act in the Mezo app, so the buttons here stay off.")).toBeVisible();
  for (const name of ["Deposit", "Withdraw", "Claim yield"]) await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
  await expect(page.getByLabel("Deposit MUSD")).toBeDisabled();
});

test("without a wallet, a looked-up address shows the action sections with every control off", async ({ page }) => {
  await page.goto("/vault");
  await page.getByRole("button", { name: "Try a sample" }).click();
  await expect(page.getByText("157.31")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();
  await expect(page.getByText("The buttons stay off until you connect the wallet that owns it.")).toBeVisible();
  for (const name of ["Deposit", "Withdraw", "Claim yield"]) await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
  await expect(page.getByLabel("Deposit MUSD")).toBeDisabled();
  await expect(page.getByLabel(/Withdraw sMUSD/)).toBeDisabled();
});

test("with mainnet switched off, a connected wallet gets no gauge staking", async ({ page }) => {
  test.skip(process.env.MAINNET_E2E === "1", "this build has mainnet switched on");
  await page.route("https://rpc.test.mezo.org/**", (route) => route.abort()); // no network in tests; the trove inputs just stay unread
  await page.addInitScript(() => {
    const provider = {
      request: async ({ method }: { method: string }) => {
        if (method === "eth_requestAccounts" || method === "eth_accounts") return ["0xfe21b2782b35be770dd4a7b05f81ce43790d676c"];
        if (method === "eth_chainId") return "0x7b7b";
        throw Object.assign(new Error(`unexpected ${method}`), { code: 4200 });
      },
    };
    window.addEventListener("eip6963:requestProvider", () =>
      window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: { uuid: "off-1", name: "Test Wallet", icon: "", rdns: "test.wallet" }, provider }) })),
    );
  });
  await page.goto("/vault?net=mainnet");
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await page.getByRole("dialog", { name: "Connect a wallet" }).getByRole("button", { name: /Test Wallet/ }).click();
  await expect(page.getByRole("heading", { name: "Actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /gauge/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Claim MEZO" })).toHaveCount(0);
});
