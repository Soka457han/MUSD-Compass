import { describe, expect, it } from "vitest";
import listings from "../fixtures/merkl-opportunities-2026-10-24.json";
import { parseMerkl, type MerklListing } from "@/lib/sources/merkl";

const venues = parseMerkl(listings as MerklListing[], new Date("2026-10-24T15:00:00Z"));

describe("parseMerkl (live sample, 24 Oct 2026)", () => {
  it("keeps only Mezo-paid MUSD venues: 2 out of 8 listings", () => {
    expect(venues.map((v) => v.name)).toEqual(["Uniswap V4 USDC/MUSD", "Curve MUSD/USDC/USDT"]);
  });

  it("drops look-alikes (MetaMask mUSD, Salt smUSD, Pharos USDC)", () => {
    const names = venues.map((v) => v.name).join(" ");
    expect(names).not.toMatch(/Aave|Salt|Pharos/);
  });

  it("Curve is one row from the outer listing; nested listings become route chips", () => {
    const curve = venues.find((v) => v.name.startsWith("Curve"))!;
    expect(curve.tvlUsd).toBeCloseTo(244_782, 0);
    expect(curve.rates.lockedApr).toBeCloseTo(4.81, 2);
    expect(curve.rates.liquidApr).toBe(0.12);
    expect(curve.routes.map((r) => r.name)).toEqual(["Curve", "Stake DAO", "Convex"]);
    expect(curve.incentiveUsdPerDay).toBeCloseTo(32.28, 2); // the outer listing's stream only, nested ones not added
  });

  it("Uniswap V4: fees not reported → liquid APR null, locked 49.83%, campaign end parsed", () => {
    const uni = venues[0];
    expect(uni.rates.liquidApr).toBeNull();
    expect(uni.rates.lockedApr).toBeCloseTo(49.83, 2);
    expect(uni.ends).toBe("2026-10-30T10:00:00.000Z"); // latestCampaignEnd 1793354400
    expect(uni.notes.join(" ")).toMatch(/not reported/);
  });
});

describe("parseUserRewards (documented response shape)", () => {
  it("claimable = amount − claimed, veMEZO on Mezo only; pending kept apart", async () => {
    const { parseUserRewards } = await import("@/lib/sources/merkl");
    const shape = (await import("../fixtures/merkl-user-rewards-shape.json")).default;
    expect(parseUserRewards(shape)).toEqual({ unclaimed: 239.28, pending: 12.5 });
    expect(parseUserRewards([])).toEqual({ unclaimed: 0, pending: 0 });
  });
});

describe("parseMerkl treats Merkl's links as untrusted", () => {
  it("keeps only https links; anything else falls back to Merkl's own app", () => {
    const evil = (listings as MerklListing[]).map((l) => ({ ...l, depositUrl: "javascript:alert(document.domain)" }));
    const out = parseMerkl(evil, new Date("2026-10-24T15:00:00Z"));
    for (const v of out) {
      expect(v.action.url).toBe("https://app.merkl.xyz");
      for (const r of v.routes) expect(r.url).toBe("https://app.merkl.xyz");
    }
    const phish = (listings as MerklListing[]).map((l) => ({ ...l, depositUrl: "http://curve-finance.example/deposit" }));
    expect(parseMerkl(phish).every((v) => v.action.url === "https://app.merkl.xyz")).toBe(true);
  });

  it("keeps a normal https deposit link as it is", () => {
    const curve = venues.find((v) => v.name.startsWith("Curve"))!;
    expect(curve.action.url).toBe("https://www.curve.finance/dex/ethereum/pools/factory-stable-ng-518/deposit");
  });
});
