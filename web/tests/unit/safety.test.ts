import { describe, expect, it } from "vitest";
import { troveAdvice } from "@/lib/safety";
import type { TroveView } from "@/lib/trove";

const trove = (o: Partial<TroveView> = {}): TroveView => ({
  address: "0x593c427d8C7bf5C555Ed41cd7CB7cCe8C9F15bB5",
  active: true,
  collateralBtc: 0.45,
  collateralUsd: 36_000,
  debt: 20_000,
  icrPct: 180,
  ratePct: 1,
  ahead: 5,
  troves: 10,
  recoveryMode: false,
  safeExtra: 0,
  btcUsd: 80_000,
  ...o,
});

describe("troveAdvice", () => {
  it("says a healthy trove is healthy and how far BTC must fall before liquidation at 110%", () => {
    const [a, ...rest] = troveAdvice(trove({ icrPct: 8832, collateralUsd: 1_280_009, debt: 14_493, ahead: 2 }));
    expect(rest).toEqual([]);
    expect(a.level).toBe("ok");
    expect(a.detail).toMatch(/BTC would have to fall about 99%/);
    expect(a.actions).toBeUndefined();
  });

  it("at 180% watches, and offers two ways back to 200%: add 0.05 BTC or repay 2,000 MUSD", () => {
    const a = troveAdvice(trove())[0];
    expect(a.level).toBe("watch");
    expect(a.actions).toEqual([
      { kind: "addColl", btc: 0.05 },
      { kind: "repay", musd: 2000 },
    ]);
  });

  it("below 150% it is act now", () => {
    expect(troveAdvice(trove({ icrPct: 140, collateralUsd: 28_000 }))[0].level).toBe("act");
  });

  it("recovery mode comes first and is act now, even for a high ratio", () => {
    const [a] = troveAdvice(trove({ recoveryMode: true, icrPct: 300, collateralUsd: 60_000 }));
    expect(a.level).toBe("act");
    expect(a.title).toMatch(/recovery mode/i);
  });

  it("first in the redemption queue is a watch that explains a redemption is not a penalty", () => {
    const advice = troveAdvice(trove({ icrPct: 400, collateralUsd: 80_000, ahead: 0 }));
    expect(advice[0].level).toBe("watch");
    expect(advice[0].detail).toMatch(/not a penalty/);
    expect(advice.some((x) => x.level === "ok")).toBe(true);
  });

  it("gives no advice for an address without an open trove", () => {
    expect(troveAdvice(trove({ active: false }))).toEqual([]);
  });

  it("rounds the amounts up, so doing exactly what it says reaches the target", () => {
    const t = trove({ collateralUsd: 36_001, btcUsd: 77_118, icrPct: 180.005 });
    const [add, repay] = troveAdvice(t)[0].actions!;
    if (add.kind !== "addColl" || repay.kind !== "repay") throw new Error("unexpected actions");
    expect(t.collateralUsd + add.btc * t.btcUsd).toBeGreaterThanOrEqual(2 * t.debt);
    expect(t.collateralUsd / (t.debt - repay.musd)).toBeGreaterThanOrEqual(2);
    // ...and not by more than the last decimal: 8 for BTC, 2 (cents) for MUSD.
    expect(add.btc - (2 * t.debt - t.collateralUsd) / t.btcUsd).toBeLessThan(1.1e-8);
    expect(repay.musd - (t.debt - t.collateralUsd / 2)).toBeLessThan(0.0101);
  });

  it("does not offer a repay that would leave the debt under Mezo's minimum (1,800 MUSD plus the 200 gas deposit), and says why", () => {
    const small = trove({ debt: 2000, collateralUsd: 3600, collateralBtc: 0.045, icrPct: 180 });
    const a = troveAdvice(small)[0];
    expect(a.actions).toEqual([{ kind: "addColl", btc: 0.005 }]);
    expect(a.detail).toMatch(/repaying would leave the debt under Mezo's minimum/);
  });

  it("offers a repay when the trove stays above the minimum afterwards", () => {
    expect(troveAdvice(trove({ debt: 20_000, collateralUsd: 36_000 }))[0].actions).toContainEqual({ kind: "repay", musd: 2000 });
  });
});
