import { describe, expect, it, vi } from "vitest";
import { MAINNET, NETWORKS } from "@/lib/chain/addresses";
import { smusdAbi, vaultGaugeAbi } from "@/lib/chain/abis";
import { buildClaimMezoStep, buildStakeSteps, buildUnstakeStep, readGaugePosition } from "@/lib/gaugeActions";
import { guard, MAINNET_CAP_MUSD } from "@/lib/sendSafely";
import type { BorrowEarnStep } from "@/lib/borrowEarn";

const account = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C" as const;
const e18 = 10n ** 18n;
const cap = BigInt(MAINNET_CAP_MUSD) * e18;

/** The wallet holds 3,000 sMUSD, has 40 staked and 1.5 MEZO earned; the gauge allowance is set per test. */
function client(o: { held?: bigint; staked?: bigint; earned?: bigint; allowance?: bigint } = {}) {
  const readContract = vi.fn(async ({ address, functionName }: { address: string; functionName: string; args?: unknown[] }) => {
    const on = address.toLowerCase();
    if (on === MAINNET.smusd.toLowerCase() && functionName === "balanceOf") return o.held ?? 3000n * e18;
    if (on === MAINNET.smusd.toLowerCase() && functionName === "allowance") return o.allowance ?? 0n;
    if (on === MAINNET.smusdGauge.toLowerCase() && functionName === "balanceOf") return o.staked ?? 40n * e18;
    if (on === MAINNET.smusdGauge.toLowerCase() && functionName === "earned") return o.earned ?? 15n * 10n ** 17n;
    throw new Error(`unexpected ${address}.${functionName}`);
  });
  return { readContract };
}

const passesGuard = (s: BorrowEarnStep) => guard({ ...s, account, walletChainId: 31612 }, { mainnetEnabled: true });

describe("readGaugePosition", () => {
  it("reads staked sMUSD and earned MEZO for the account from the mainnet gauge, as decimal strings", async () => {
    const c = client();
    expect(await readGaugePosition(c as never, account)).toEqual({ staked: "40", earnedMezo: "1.5" });
    expect(c.readContract).toHaveBeenCalledWith(expect.objectContaining({ address: MAINNET.smusdGauge, functionName: "balanceOf", args: [account] }));
    expect(c.readContract).toHaveBeenCalledWith(expect.objectContaining({ address: MAINNET.smusdGauge, functionName: "earned", args: [account] }));
  });
});

describe("buildStakeSteps", () => {
  it("approves exactly the amount for the gauge, then deposits it, on mainnet", async () => {
    const c = client();
    const steps = await buildStakeSteps(c as never, account, 100n * e18);
    expect(steps.map((s) => [s.address, s.functionName, s.args, s.network])).toEqual([
      [MAINNET.smusd, "approve", [MAINNET.smusdGauge, 100n * e18], "mainnet"],
      [MAINNET.smusdGauge, "deposit", [100n * e18], "mainnet"],
    ]);
    expect(steps[0].abi).toBe(smusdAbi);
    expect(steps[1].abi).toBe(vaultGaugeAbi);
    expect(steps.map((s) => s.label)).toEqual(["Approve exactly 100 sMUSD for the gauge", "Stake 100 sMUSD in the gauge"]);
    expect(c.readContract).toHaveBeenCalledWith(expect.objectContaining({ address: MAINNET.smusd, functionName: "allowance", args: [account, NETWORKS.mainnet.smusdGauge] }));
    steps.forEach((s) => expect(() => passesGuard(s)).not.toThrow());
  });
  it("skips the approval when the allowance already covers the amount, and keeps it when it is one wei short", async () => {
    const enough = await buildStakeSteps(client({ allowance: 100n * e18 }) as never, account, 100n * e18);
    expect(enough.map((s) => s.functionName)).toEqual(["deposit"]);
    const short = await buildStakeSteps(client({ allowance: 100n * e18 - 1n }) as never, account, 100n * e18);
    expect(short.map((s) => s.functionName)).toEqual(["approve", "deposit"]);
  });
  it("stakes the whole cap, and every step still passes the guard", async () => {
    const steps = await buildStakeSteps(client() as never, account, cap);
    steps.forEach((s) => expect(() => passesGuard(s)).not.toThrow());
  });
  it("refuses zero, a negative amount, more than the cap, and more than the wallet holds", async () => {
    await expect(buildStakeSteps(client() as never, account, 0n)).rejects.toThrow(/more than zero/);
    await expect(buildStakeSteps(client() as never, account, -1n)).rejects.toThrow(/more than zero/);
    await expect(buildStakeSteps(client() as never, account, cap + 1n)).rejects.toThrow(/at most 2,500 sMUSD/);
    await expect(buildStakeSteps(client({ held: 9999n * 10n ** 16n }) as never, account, 100n * e18)).rejects.toThrow(/only holds 99.99 sMUSD/);
  });
});

describe("buildUnstakeStep", () => {
  it("withdraws the amount from the gauge, up to all of it", async () => {
    const s = await buildUnstakeStep(client() as never, account, 40n * e18);
    expect([s.address, s.functionName, s.args, s.network, s.abi]).toEqual([MAINNET.smusdGauge, "withdraw", [40n * e18], "mainnet", vaultGaugeAbi]);
    expect(s.label).toBe("Unstake 40 sMUSD from the gauge");
    expect(() => passesGuard(s)).not.toThrow();
  });
  it("refuses zero, a negative amount and more than is staked", async () => {
    await expect(buildUnstakeStep(client() as never, account, 0n)).rejects.toThrow(/more than zero/);
    await expect(buildUnstakeStep(client() as never, account, -1n)).rejects.toThrow(/more than zero/);
    await expect(buildUnstakeStep(client() as never, account, 40n * e18 + 1n)).rejects.toThrow(/only 40 sMUSD staked/);
  });
});

describe("buildClaimMezoStep", () => {
  it("claims MEZO for the account itself", () => {
    const s = buildClaimMezoStep(account);
    expect([s.address, s.functionName, s.args, s.network, s.abi]).toEqual([MAINNET.smusdGauge, "getReward", [account], "mainnet", vaultGaugeAbi]);
    expect(() => passesGuard(s)).not.toThrow();
    // The guard only lets it through for the account that signs.
    expect(() => guard({ ...s, account: "0x000000000000000000000000000000000000dEaD", walletChainId: 31612 }, { mainnetEnabled: true })).toThrow(/your own account/);
  });
});
