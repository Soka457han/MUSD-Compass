import { describe, expect, it, vi } from "vitest";
import { parseEther } from "viem";
import { NETWORKS } from "@/lib/chain/addresses";
import { collateralFor } from "@/lib/borrow";
import { amountConfirmed, assertSafeAtSend, buildBorrowEarnSteps, icrAfterOpen } from "@/lib/borrowEarn";

const account = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C" as const;
const UPPER = "0x1111111111111111111111111111111111111111";
const LOWER = "0x2222222222222222222222222222222222222222";
const e18 = 10n ** 18n;
const quote = { btcUsd: 80_000, feePct: 0.1, gasComp: 200 };

/** A client that answers the reads Borrow → Earn makes; price and state are set per test. */
function client(o: { price?: number; trove?: number; allowance?: bigint; btc?: bigint } = {}) {
  const readContract = vi.fn(async ({ functionName }: { address: string; functionName: string; args?: unknown[] }) => {
    switch (functionName) {
      case "fetchPrice": return BigInt(Math.round((o.price ?? 80_000) * 1e6)) * 10n ** 12n;
      case "minNetDebt": return 1800n * e18;
      case "borrowingRate": return 10n ** 15n; // 0.1%
      case "MUSD_GAS_COMPENSATION": return 200n * e18;
      case "getTroveStatus": return o.trove ?? 0;
      case "allowance": return o.allowance ?? 0n;
      case "getSize": return 10n;
      case "getApproxHint": return [UPPER, 0n, 1n];
      case "findInsertPosition": return [UPPER, LOWER];
      default: throw new Error(`unexpected ${functionName}`);
    }
  });
  return { readContract, getBalance: vi.fn(async () => o.btc ?? parseEther("1")) };
}

describe("icrAfterOpen", () => {
  it("is 200% for the collateral collateralFor picks: 0.05505 BTC × $80,000 ÷ (2,000 × 1.001 + 200)", () => {
    const coll = Number(collateralFor(2000, quote)) / 1e18;
    expect(icrAfterOpen(coll, 2000, 0.1, 200, 80_000)).toBeCloseTo(200, 2);
  });
});

describe("assertSafeAtSend", () => {
  const plan = { debt: 2000n * e18, collateral: collateralFor(2000, quote) };
  it("passes at the quoted price", async () => {
    await expect(assertSafeAtSend(client() as never, "mainnet", plan)).resolves.toBeUndefined();
  });
  it("refuses, with the new ratio, when BTC fell 10% since the quote", async () => {
    await expect(assertSafeAtSend(client({ price: 72_000 }) as never, "mainnet", plan)).rejects.toThrow(/BTC moved.*180\.0%.*below the 200%.*Nothing was sent/);
  });
});

describe("buildBorrowEarnSteps", () => {
  it("builds open trove (with hints and the BTC as value), exact approve, deposit, all tagged with the network", async () => {
    const { steps, plan } = await buildBorrowEarnSteps(client() as never, "mainnet", account, 2000);
    expect(steps.map((s) => s.functionName)).toEqual(["openTrove", "approve", "deposit"]);
    expect(steps.every((s) => s.network === "mainnet")).toBe(true);
    const [open, approve, deposit] = steps;
    expect(open.address).toBe(NETWORKS.mainnet.borrowerOperations);
    expect(open.args).toEqual([2000n * e18, UPPER, LOWER]);
    expect(open.value).toBe(plan.collateral);
    expect(plan.debt).toBe(2000n * e18);
    expect(approve.address).toBe(NETWORKS.mainnet.musd);
    expect(approve.args).toEqual([NETWORKS.mainnet.smusd, 2000n * e18]);
    expect(deposit.address).toBe(NETWORKS.mainnet.smusd);
    expect(deposit.args).toEqual([2000n * e18]);
  });
  it("skips the approval when the vault is already allowed to take the amount", async () => {
    const { steps } = await buildBorrowEarnSteps(client({ allowance: 2000n * e18 }) as never, "testnet", account, 2000);
    expect(steps.map((s) => s.functionName)).toEqual(["openTrove", "deposit"]);
  });
  it("refuses a debt below Mezo's minimum, counting the fee: 1,798.21 passes, 1,798 does not", async () => {
    await expect(buildBorrowEarnSteps(client() as never, "mainnet", account, 1798)).rejects.toThrow(/at least 1,798\.21 MUSD/);
    await expect(buildBorrowEarnSteps(client() as never, "mainnet", account, 1798.21)).resolves.toBeDefined();
  });
  it("refuses when the account already has a trove (openTrove would revert)", async () => {
    await expect(buildBorrowEarnSteps(client({ trove: 1 }) as never, "mainnet", account, 2000)).rejects.toThrow(/already has a trove/);
  });
  it("refuses when the wallet cannot cover the BTC to lock, keeping a little for gas", async () => {
    await expect(buildBorrowEarnSteps(client({ btc: parseEther("0.05") }) as never, "mainnet", account, 2000)).rejects.toThrow(/needs about 0\.05505 BTC/);
  });
});

describe("amountConfirmed", () => {
  it("is true only when the typed text is the amount being borrowed", () => {
    expect(amountConfirmed("2000", 2000)).toBe(true);
    expect(amountConfirmed(" 2,000 ", 2000)).toBe(true);
    expect(amountConfirmed("2000.00", 2000)).toBe(true);
    expect(amountConfirmed("", 2000)).toBe(false);
    expect(amountConfirmed("200", 2000)).toBe(false);
    expect(amountConfirmed("abc", 2000)).toBe(false);
  });
});
