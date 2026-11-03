import { describe, expect, it, vi } from "vitest";
import { zeroAddress } from "viem";
import { NETWORKS } from "@/lib/chain/addresses";
import { getTroveHints, nominalIcr } from "@/lib/hints";

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const HINT = "0x3333333333333333333333333333333333333333";
const e18 = 10n ** 18n;

function client(opts: { size?: bigint; fail?: string } = {}) {
  const readContract = vi.fn(async ({ functionName }: { address: string; functionName: string; args?: unknown[] }) => {
    if (opts.fail === functionName) throw new Error("rpc down");
    if (functionName === "getSize") return opts.size ?? 100n;
    if (functionName === "getApproxHint") return [HINT, 0n, 7n];
    if (functionName === "findInsertPosition") return [A, B];
    throw new Error(`unexpected ${functionName}`);
  });
  return { readContract };
}

describe("nominalIcr", () => {
  it("is collateral × 1e20 ÷ debt, the value SortedTroves sorts by (checked on chain: 1 BTC / 2,000 MUSD = 5e16)", () => {
    expect(nominalIcr(1n * e18, 2000n * e18)).toBe(50_000_000_000_000_000n);
  });
});

describe("getTroveHints", () => {
  it("asks HintHelpers for an approximate hint with 15·√size trials, then SortedTroves for the exact neighbours", async () => {
    const c = client({ size: 100n });
    const r = await getTroveHints(c as never, "mainnet", { debt: 2000n * e18, collateral: 1n * e18 });
    expect(r).toEqual({ upper: A, lower: B, usedFallback: false });
    const calls = c.readContract.mock.calls.map(([a]) => a as { address: string; functionName: string; args?: unknown[] });
    const approx = calls.find((x) => x.functionName === "getApproxHint")!;
    expect(approx.address).toBe(NETWORKS.mainnet.hintHelpers);
    expect(approx.args?.slice(0, 2)).toEqual([50_000_000_000_000_000n, 150n]);
    const insert = calls.find((x) => x.functionName === "findInsertPosition")!;
    expect(insert.address).toBe(NETWORKS.mainnet.sortedTroves);
    expect(insert.args).toEqual([50_000_000_000_000_000n, HINT, HINT]);
  });

  it("uses the testnet contracts on testnet", async () => {
    const c = client();
    await getTroveHints(c as never, "testnet", { debt: 2000n * e18, collateral: 1n * e18 });
    const addrs = c.readContract.mock.calls.map(([a]) => (a as { address: string }).address);
    expect(addrs).toContain(NETWORKS.testnet.hintHelpers);
    expect(addrs).not.toContain(NETWORKS.mainnet.hintHelpers);
  });

  it("returns zero hints without a search when no trove is open", async () => {
    const c = client({ size: 0n });
    const r = await getTroveHints(c as never, "mainnet", { debt: 2000n * e18, collateral: 1n * e18 });
    expect(r).toEqual({ upper: zeroAddress, lower: zeroAddress, usedFallback: false });
    expect(c.readContract.mock.calls.some(([a]) => (a as { address: string; functionName: string }).functionName === "getApproxHint")).toBe(false);
  });

  it("falls back to zero hints and says so when a read fails (a wrong hint only costs gas)", async () => {
    const r = await getTroveHints(client({ fail: "getApproxHint" }) as never, "mainnet", { debt: 2000n * e18, collateral: 1n * e18 });
    expect(r).toEqual({ upper: zeroAddress, lower: zeroAddress, usedFallback: true });
  });

  it("refuses a zero debt instead of dividing by it", async () => {
    await expect(getTroveHints(client() as never, "mainnet", { debt: 0n, collateral: e18 })).rejects.toThrow(/debt must be above zero/);
  });
});
