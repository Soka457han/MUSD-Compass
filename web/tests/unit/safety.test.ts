import { describe, expect, it } from "vitest";
import { REDEMPTION_PRESSURE_TITLE, troveAdvice } from "@/lib/safety";
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
  nicr: "1800000000000000000",
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

describe("redemption pressure", () => {
  const below = { musdUsd: 0.9924, floorUsd: 0.9925 };
  const comfy = (o: Partial<TroveView> = {}) => trove({ icrPct: 300, collateralUsd: 60_000, ahead: 0, troves: 4, ...o });
  const pressure = (t: TroveView, m: typeof below | null = below) => troveAdvice(t, undefined, undefined, m).find((a) => a.title === REDEMPTION_PRESSURE_TITLE);

  it("shows for the first in line of 4 when MUSD is under the floor, with real numbers and no actions", () => {
    const a = pressure(comfy())!;
    expect(a.level).toBe("watch");
    expect(a.detail).toBe("MUSD trades at $0.9924 on Mezo's MUSD/mUSDC pool, under the $0.9925 floor (1 minus the redemption fee). Redeeming MUSD for BTC pays right now, and redemptions start with the lowest-ratio troves. 0 of 4 troves would be redeemed before yours. A redemption repays part of your debt and takes the matching BTC. A higher ratio moves you back in the line.");
    expect(a.actions).toBeUndefined();
  });
  it("not above the floor, at the floor, or with no market", () => {
    expect(pressure(comfy(), { musdUsd: 0.9951, floorUsd: 0.9925 })).toBeUndefined();
    expect(pressure(comfy(), { musdUsd: 0.9925, floorUsd: 0.9925 })).toBeUndefined();
    expect(pressure(comfy(), null)).toBeUndefined();
  });
  it("not when ahead is unknown, not for position 1 of 4, not for an inactive trove", () => {
    expect(pressure(comfy({ ahead: null }))).toBeUndefined();
    expect(pressure(comfy({ ahead: 1 }))).toBeUndefined();
    expect(pressure(comfy({ active: false }))).toBeUndefined();
  });
  it("front quarter of 100: position 10 yes, position 30 no", () => {
    expect(pressure(comfy({ ahead: 10, troves: 100 }))).toBeDefined();
    expect(pressure(comfy({ ahead: 30, troves: 100 }))).toBeUndefined();
  });
  it("an omitted market gives exactly today's output", () => {
    const t = comfy();
    expect(troveAdvice(t, undefined, undefined, undefined)).toEqual(troveAdvice(t));
    expect(troveAdvice(t).map((a) => a.title)).toEqual(["Your trove is first in line for redemptions", "Your ratio is comfortable"]);
  });
  it("the pressure warning replaces first in line, so the two never show together", () => {
    const first = trove({ ahead: 0, troves: 4, icrPct: 300, collateralUsd: 60_000 });
    const under = troveAdvice(first, undefined, undefined, { musdUsd: 0.9924, floorUsd: 0.9925 }).map((a) => a.title);
    expect(under).toContain(REDEMPTION_PRESSURE_TITLE);
    expect(under).not.toContain("Your trove is first in line for redemptions");
    expect(troveAdvice(first, undefined, undefined, { musdUsd: 0.9951, floorUsd: 0.9925 }).map((a) => a.title)).toContain("Your trove is first in line for redemptions");
  });
});
