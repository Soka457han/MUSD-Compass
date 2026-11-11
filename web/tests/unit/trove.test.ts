import { describe, expect, it, vi } from "vitest";
import { NETWORKS } from "@/lib/chain/addresses";
import { previewTrove, readTrove, redemptionPosition, type TroveView, safeExtraBorrow } from "@/lib/trove";

describe("readTrove by network", () => {
  const e18 = 10n ** 18n;
  const client = () => ({
    readContract: vi.fn(async ({ functionName }: { address: string; functionName: string }) => {
      switch (functionName) {
        case "fetchPrice": return 80_000n * e18;
        case "getTroveStatus": return 1;
        case "getEntireDebtAndColl": return [1n * e18, 2000n * e18, 0n, 0n, 0n, 0n];
        case "getCurrentICR": return 4n * e18;
        case "getTroveInterestRate": return 100;
        case "getNominalICR": return 5n * 10n ** 16n;
        case "checkRecoveryMode": return false;
        default: throw new Error(`unexpected ${functionName}`);
      }
    }),
  });
  const owner = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C";
  const usedBy = (c: ReturnType<typeof client>) => new Set(c.readContract.mock.calls.map(([a]) => (a as { address: string }).address));

  it("reads the contracts of the network it is asked about, and mainnet by default", async () => {
    const t = client();
    await readTrove(t as never, owner, 0.1, null, "testnet");
    expect(usedBy(t)).toEqual(new Set([NETWORKS.testnet.troveManager, NETWORKS.testnet.priceFeed]));
    const m = client();
    await readTrove(m as never, owner, 0.1, null);
    expect(usedBy(m)).toEqual(new Set([NETWORKS.mainnet.troveManager, NETWORKS.mainnet.priceFeed]));
  });
});

describe("safeExtraBorrow", () => {
  it("keeps ICR at 200 % after the 0.1 % fee is added to the debt", () => {
    const extra = safeExtraBorrow(100_000, 30_000, 0.1);
    expect(extra).toBeCloseTo(19_980.02, 2);
    expect(100_000 / (30_000 + extra * 1.001)).toBeCloseTo(2, 10);
  });
  it("is 0 when the trove is already below the floor", () => {
    expect(safeExtraBorrow(50_000, 30_000, 0.1)).toBe(0);
  });
});

describe("redemptionPosition", () => {
  it("counts troves with a lower nominal ratio (they are redeemed first)", () => {
    expect(redemptionPosition([5n, 1n, 9n, 3n], 4n)).toBe(2);
    expect(redemptionPosition([5n, 9n], 1n)).toBe(0);
  });
});

describe("previewTrove", () => {
  const e18 = 10n ** 18n;
  const t: TroveView = { address: "0x593c000000000000000000000000000000005bb5", active: true, collateralBtc: 1, collateralUsd: 80_000, debt: 40_000, icrPct: 200, ratePct: 1, ahead: 0, troves: 4, recoveryMode: false, safeExtra: 0, btcUsd: 80_000, nicr: String(25n * e18 / 10n) };
  const own = 25n * e18 / 10n; // 2.5
  const nicrs = [own, 3n * e18, 4n * e18, 5n * e18];

  it("adding BTC raises icrPct as new collateral x price / debt x 100", () => {
    const r = previewTrove(t, { addBtc: 0.5 }, nicrs);
    expect(r.icrPct).toBe((1.5 * 80_000) / 40_000 * 100);
    expect(r.collateralBtc).toBe(1.5);
    expect(r.debt).toBe(40_000);
  });
  it("repaying raises icrPct too", () => {
    const r = previewTrove(t, { repayMusd: 10_000 }, nicrs);
    expect(r.icrPct).toBeCloseTo((80_000 / 30_000) * 100, 10);
    expect(r.debt).toBe(30_000);
  });
  it("a change that overtakes a neighbour moves ahead from 0 to 1, and its own entry is not counted", () => {
    expect(previewTrove(t, {}, nicrs).ahead).toBe(0);
    expect(previewTrove(t, { addBtc: 0.1 }, nicrs).ahead).toBe(0); // 2.75 is still under 3
    expect(previewTrove(t, { addBtc: 0.3 }, nicrs).ahead).toBe(1); // 3.25 passes the 3, and own 2.5 is skipped
  });
  it("null nicrs gives ahead null and 0 troves", () => {
    expect(previewTrove(t, { addBtc: 1 }, null)).toMatchObject({ ahead: null, troves: 0 });
  });
  it("rejects negative, non-finite and debt-clearing changes", () => {
    expect(() => previewTrove(t, { addBtc: -1 }, null)).toThrow(Error);
    expect(() => previewTrove(t, { repayMusd: NaN }, null)).toThrow(Error);
    expect(() => previewTrove(t, { addBtc: Infinity }, null)).toThrow(Error);
    expect(() => previewTrove(t, { repayMusd: 40_000 }, null)).toThrow(Error);
  });
  it("previewTrove: when the trove's own entry is not in the cached queue, the place is unknown, never one too high", () => {
    const t = { collateralBtc: 1, debt: 20_000, btcUsd: 80_000, nicr: "5000" } as never;
    expect(previewTrove(t, { addBtc: 0.5 }, [1000n, 2000n, 9000n]).ahead).toBeNull(); // 5000 is missing: the queue is stale
    expect(previewTrove(t, { addBtc: 0.5 }, [1000n, 5000n, 5000n, 9000n]).ahead).toBe(2); // a tie: one 5000 is ours, the other still counts
  });
});
