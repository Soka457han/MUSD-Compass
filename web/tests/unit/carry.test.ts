import { describe, expect, it } from "vitest";
import {
  amortisedPct,
  borrowCostPct,
  dilutedApr,
  entryCheck,
  minNewTroveAmount,
  venueCarry,
  type CarryInput,
} from "@/lib/carry/carry";
import { breakEven } from "@/lib/carry/breakEven";

// Live borrow parameters read on 24 Oct 2026 (design §15 #2, #23).
const params = { feePct: 0.1, gasCompensation: 200, minNetDebt: 1800 };
const base: CarryInput = { amount: 2000, days: 90, mode: "borrower", trove: "new", ratePct: 1, params };

describe("borrowCostPct", () => {
  it("is zero for holders", () => {
    expect(borrowCostPct({ ...base, mode: "holder" })).toBe(0);
  });

  it("new trove: interest on amount + fee + 200, plus the fee amortised", () => {
    // debt = 2000 + 2 + 200 = 2202 → 1% × 2202/2000 = 1.101%; fee 0.1% × 365/90 = 0.4056%
    expect(borrowCostPct(base)).toBeCloseTo(1.101 + 0.40556, 4);
  });

  it("existing trove: no gas compensation", () => {
    // debt added = 2002 → 1.001%; plus 0.4056%
    expect(borrowCostPct({ ...base, trove: "existing" })).toBeCloseTo(1.001 + 0.40556, 4);
  });

  it("fee amortisation at 30 / 90 / 365 days", () => {
    expect(amortisedPct(2, 2000, 30)).toBeCloseTo(1.2167, 3);
    expect(amortisedPct(2, 2000, 90)).toBeCloseTo(0.4056, 3);
    expect(amortisedPct(2, 2000, 365)).toBeCloseTo(0.1, 6);
  });
});

describe("venueCarry", () => {
  it("design worked example: borrower, 2,000 MUSD, 90 days, 1% → sMUSD cash carry 2.72%", () => {
    const r = venueCarry({ liquidApr: 4.23, lockedApr: 0, fixedCostUsd: 0, tvl: null }, base);
    expect(r.cash).toBeCloseTo(2.72, 2);
    expect(r.total).toBe(r.cash);
  });

  it("locked rewards only count in total carry", () => {
    const r = venueCarry({ liquidApr: 0, lockedApr: 49.92, fixedCostUsd: 0, tvl: 35502 }, { ...base, mode: "holder" });
    expect(r.cash).toBe(0);
    expect(r.locked).toBeCloseTo(47.26, 2); // diluted by the deposit
    expect(r.total).toBeCloseTo(47.26, 2);
  });

  it("returns null carry when the venue has no APR", () => {
    const r = venueCarry({ liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl: 1000 }, base);
    expect(r.cash).toBeNull();
    expect(r.total).toBeNull();
  });
});

describe("dilutedApr", () => {
  it("Uniswap V4: 49.92% × 35,502 ÷ 37,502 = 47.26%", () => {
    expect(dilutedApr(49.92, 35502, 2000)).toBeCloseTo(47.26, 2);
  });
  it("leaves the APR alone when TVL is unknown", () => {
    expect(dilutedApr(5, null, 2000)).toBe(5);
  });
});

describe("minNewTroveAmount", () => {
  it("amount + fee ≥ 1,800 → 1,798.21 (rounded up to cents)", () => {
    expect(minNewTroveAmount(params)).toBe(1798.21);
    expect(1798.21 * 1.001).toBeGreaterThanOrEqual(1800);
  });
});

describe("breakEven", () => {
  const holder: CarryInput = { ...base, mode: "holder" };
  const smusd = { liquidApr: 4.23, lockedApr: 0, fixedCostUsd: 0, tvl: null };

  it("Uniswap V4 total carry beats sMUSD only up to ≈383k (dilution cap)", () => {
    const uni = { liquidApr: 0, lockedApr: 49.92, fixedCostUsd: 0, tvl: 35502 };
    const r = breakEven(uni, smusd, holder);
    expect(r.cash.kind).toBe("never");
    expect(r.total.kind).toBe("range");
    if (r.total.kind === "range") {
      expect(r.total.max).toBeGreaterThan(375_000);
      expect(r.total.max).toBeLessThan(392_000);
    }
  });

  it("fixed costs create a lower bound", () => {
    const venue = { liquidApr: 8, lockedApr: 0, fixedCostUsd: 20, tvl: null };
    const r = breakEven(venue, smusd, holder);
    // 8 − 20/a × 100 × 365/90 > 4.23 → a > ≈2,151
    expect(r.cash.kind).toBe("from");
    if (r.cash.kind === "from") {
      expect(r.cash.min).toBeGreaterThan(2_000);
      expect(r.cash.min).toBeLessThan(2_400);
    }
  });

  it("new-trove scans start at the minimum borrow", () => {
    const venue = { liquidApr: 8, lockedApr: 0, fixedCostUsd: 0, tvl: null };
    const r = breakEven(venue, smusd, base);
    expect(r.cash).toEqual({ kind: "from", min: 1798.21 });
  });
});

describe("entryCheck", () => {
  const holder: CarryInput = { ...base, mode: "holder" };
  it("no one-off costs on Mezo: cash kept is amount × APR × days/365", () => {
    const c = entryCheck({ liquidApr: 4, lockedApr: 0, fixedCostUsd: 0, tvl: null }, holder);
    expect(c.keepMusd).toBeCloseTo((2000 * 4 * 90) / 36_500, 6); // 19.73
    expect(c.paybackDays).toBeNull();
  });
  it("Ethereum: the round trip is earned back after cost ÷ daily yield days", () => {
    const c = entryCheck({ liquidApr: 3.65, lockedApr: 0, fixedCostUsd: 2, tvl: null }, holder);
    expect(c.oneOffMusd).toBe(2);
    expect(c.paybackDays).toBe(10); // 2000 × 3.65% / 365 = 0.2 MUSD a day
  });
  it("never earned back when the yield is below the running borrow interest", () => {
    const c = entryCheck({ liquidApr: 0.5, lockedApr: 0, fixedCostUsd: 2, tvl: null }, base);
    expect(c.oneOffMusd).toBeCloseTo(4, 6); // 2 + the 0.1% fee on 2,000
    expect(c.paybackDays).toBe("never");
    expect(c.keepMusd!).toBeLessThan(0);
  });
});

describe("emissions", () => {
  it("liquid MEZO emissions count as cash and are diluted by the amount added", () => {
    const c = venueCarry({ liquidApr: 0, lockedApr: null, fixedCostUsd: 0, tvl: 8000, emissionsApr: 2 }, { ...base, mode: "holder" });
    expect(c.cash).toBeCloseTo((2 * 8000) / 10_000, 6); // 2,000 MUSD into an 8,000 pool
  });
});
