import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("vault (360 px, fixture data)", () => {
  test("says it is testnet, works without a wallet, and the sample shows a position", async ({ page }) => {
    await page.goto("/vault");
    await expect(page.getByRole("note")).toContainText("Testnet action");
    await expect(page.getByText("No wallet in this browser. Open this page inside")).toBeVisible();
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

test("Connect wallet opens the wallet picker: detected EVM wallets, what is not supported yet, and how to close it", async ({ page }) => {
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
  await expect(dialog.getByText("Phone wallets by QR code, planned for Wave 2")).toBeVisible();
  await expect(dialog.getByText("Unisat")).toBeVisible();
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
