import { describe, expect, it } from "vitest";
import { MAINNET } from "@/lib/chain/addresses";
import { borrowApyPct, morphoSupplyApyPct, morphoVenues, type MorphoRead } from "@/lib/sources/morpho";

// Rate that gives the 0.4769% borrow APY recorded on chain at block 13091603 (8 Nov 2026).
const RATE = BigInt(Math.round((Math.log(1.004769) / 31_536_000) * 1e18));
const read = (over: Partial<MorphoRead> = {}): MorphoRead => ({ id: "0x29c2a844b71bb5db40ca26e8880552dcd40517aa10e945b15ef616c46d5d6707", loanToken: MAINNET.musd, supplied: "0", borrowed: "0", fee: "0", rate: RATE.toString(), now: "2026-11-08T17:52:08.000Z", ...over });

describe("morphoSupplyApyPct", () => {
  it("is borrow APY times utilization", () => {
    expect(borrowApyPct(RATE)).toBeCloseTo(0.4769, 3);
    expect(morphoSupplyApyPct(RATE, 100, 50, 0n)).toBeCloseTo(0.23845, 3);
  });
  it("takes the fee off and is 0 with nothing supplied or borrowed", () => {
    expect(morphoSupplyApyPct(RATE, 100, 50, 10n ** 17n)).toBeCloseTo(0.2146, 3);
    expect(morphoSupplyApyPct(RATE, 0, 0, 0n)).toBe(0);
    expect(morphoSupplyApyPct(RATE, 100, 0, 0n)).toBe(0);
  });
});

describe("morphoVenues", () => {
  it("lists an empty market as size only, with the borrow APY in the notes", () => {
    const [v] = morphoVenues([read()]);
    expect(v.id).toBe("mezo-morpho-0x29c2a844");
    expect(v.rates.liquidApr).toBeNull();
    expect(v.tvlUsd).toBe(0);
    expect(v.notes).toContain("Nothing supplied yet: the rate appears once MUSD is lent here.");
    expect(v.notes[1]).toBe("Lenders earn the interest borrowers pay on Mezo's own Morpho Blue; borrow APY 0.48%, utilization 0.0%.");
    expect(v.action.url).toBe("https://surety-credit.vercel.app");
  });
  it("gives a funded market its supply APY and size", () => {
    const [v] = morphoVenues([read({ supplied: (200n * 10n ** 18n).toString(), borrowed: (100n * 10n ** 18n).toString() })]);
    expect(v.rates.liquidApr).toBeCloseTo(0.23845, 3);
    expect(v.tvlUsd).toBe(200);
    expect(v.notes.join(" ")).not.toContain("Nothing supplied");
  });
  it("still lists a funded market without a rate when the IRM read failed", () => {
    const [v] = morphoVenues([read({ supplied: (10n ** 18n).toString(), rate: null })]);
    expect(v.rates.liquidApr).toBeNull();
    expect(v.notes[0]).toContain("borrow APY unavailable");
  });
  it("skips a market whose loan token is not MUSD", () => {
    expect(morphoVenues([read({ loanToken: MAINNET.btc })])).toEqual([]);
  });
});
