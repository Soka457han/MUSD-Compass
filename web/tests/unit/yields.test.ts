import { describe, expect, it } from "vitest";
import listings from "../fixtures/merkl-opportunities-2026-10-24.json";
import { parseMerkl, type MerklListing } from "@/lib/sources/merkl";
import { unavailable, type Venue } from "@/lib/venue";
import { buildYields, parseQuery, type Sources } from "@/lib/yields";

const now = "2026-10-24T15:00:00.000Z";
const smusd: Venue = {
  id: "mezo-smusd", name: "MUSD Savings Vault (sMUSD)", chain: "Mezo",
  rates: { liquidApr: 4.23, lockedApr: 0, fixedCostUsd: 0, tvl: null }, tvlUsd: 7_382_555, ends: null,
  action: { label: "Deposit", url: "/vault" }, source: { label: "Mezo", url: "x" }, routes: [], tags: [], notes: [], status: "ok", updatedAt: now,
};
const pool: Venue = { ...smusd, id: "mezo-pool", name: "Mezo pool", rates: { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl: 5e6 }, tvlUsd: 5e6 };
const sp: Venue = { ...pool, id: "mezo-sp", name: "Stability Pool", tvlUsd: 14e6 };
const sources: Sources = {
  venues: [pool, ...parseMerkl(listings as MerklListing[]), sp, smusd],
  benchmarkId: "mezo-smusd",
  borrow: { feePct: 0.1, gasCompensation: 200, minNetDebt: 1800, ratePct: 1 },
  paramsLive: true,
  ethRoundTrip: { usd: 1.3, basis: "est." },
  mezoPriceUsd: 0.00297,
};
const q = (s: string) => {
  const r = parseQuery(new URLSearchParams(s));
  if (!r.ok) throw new Error(r.error);
  return r.query;
};

describe("parseQuery", () => {
  it("defaults: holder, 2,000 MUSD, new trove, 90 days, live rate", () => {
    expect(q("")).toEqual({ amount: 2000, mode: "holder", trove: "new", days: 90, ratePct: null });
  });
  it.each([
    ["amount=abc", /amount/],
    ["amount=0", /amount/],
    ["mode=whale", /mode/],
    ["days=60", /days/],
    ["rate=9", /rate/],
    ["trove=old", /trove/],
  ])("rejects %s with a readable message", (s, re) => {
    const r = parseQuery(new URLSearchParams(s));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(re);
  });
});

describe("buildYields", () => {
  it("sorts by cash carry; rows without an APR go last, biggest first", () => {
    const r = buildYields(sources, q(""));
    expect(r.venues.map((v) => v.id)).toEqual([
      "mezo-smusd", // 4.23
      expect.stringContaining("curve"), // 0.12 − costs
      expect.stringContaining("uniswap"), // 0 − costs
      "mezo-sp", // no APR, 14M
      "mezo-pool", // no APR, 5M
    ]);
  });

  it("borrower example from the design: sMUSD cash carry 2.72%", () => {
    const r = buildYields(sources, q("mode=borrower&amount=2000&days=90&rate=1"));
    const s = r.venues.find((v) => v.id === "mezo-smusd")!;
    expect(s.carry.cash).toBeCloseTo(2.72, 2);
    expect(r.assumptions.holding).toBe("Assumes 90-day hold");
  });

  it("Ethereum rows carry the round-trip cost and a two-number break-even; Mezo rows don't", () => {
    const r = buildYields(sources, q(""));
    const uni = r.venues.find((v) => v.id.includes("uniswap"))!;
    expect(uni.rates.fixedCostUsd).toBe(1.3);
    expect(uni.breakEven?.cash.kind).toBe("never");
    expect(uni.breakEven?.total.kind).toBe("range");
    expect(r.venues.find((v) => v.id === "mezo-smusd")!.breakEven).toBeNull();
  });

  it("a new-trove amount under the minimum returns a notice, not an error", () => {
    const r = buildYields(sources, q("mode=borrower&amount=1000"));
    expect(r.notice).toMatch(/at least 1,800 MUSD/);
  });

  it("an unavailable source still appears, last, with no carry", () => {
    const down = unavailable("merkl", "Mezo-paid Ethereum pools", "Ethereum", { label: "Merkl", url: "x" }, { label: "Merkl", url: "x" });
    const r = buildYields({ ...sources, venues: [down, smusd] }, q(""));
    expect(r.venues.at(-1)!.status).toBe("unavailable");
    expect(r.venues.at(-1)!.carry.cash).toBeNull();
    expect(r.venues.at(-1)!.breakEven).toBeNull();
  });
});
