import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import { mezoVenues, parseMezoPools, poolTvlUsd, readMezo, toBorrowParams, type MezoChain } from "@/lib/sources/mezo";
import { roundTripCostUsd } from "@/lib/sources/ethereum";
import { MAINNET } from "@/lib/chain/addresses";

describe("toBorrowParams (raw values read live 24 Oct)", () => {
  it("converts 1e18 fractions and bps", () => {
    expect(
      toBorrowParams({
        minNetDebt: 1800n * 10n ** 18n,
        borrowingRate: 10n ** 15n,
        gasCompensation: 200n * 10n ** 18n,
        interestRateBps: 100,
      }),
    ).toEqual({ minNetDebt: 1800, feePct: 0.1, gasCompensation: 200, ratePct: 1 });
  });
});

describe("poolTvlUsd", () => {
  it("MUSD/BTC pool ≈ $77.5k at BTC $80,478 (24 Oct reserves)", () => {
    const tvl = poolTvlUsd(
      [
        { address: MAINNET.btc, reserve: parseUnits("0.4764952100162306", 18), decimals: 18 },
        { address: MAINNET.musd, reserve: parseUnits("39149.65046743145", 18), decimals: 18 },
      ],
      { btcUsd: 80_477.8, mezoUsd: 0.00297 },
    );
    expect(tvl).toBeGreaterThan(77_000);
    expect(tvl).toBeLessThan(78_000);
  });

  it("prices MEZO at the given price (MEZO/MUSD-200 ≈ $5.8k)", () => {
    const tvl = poolTvlUsd(
      [
        { address: MAINNET.mezo, reserve: parseUnits("749084", 18), decimals: 18 },
        { address: MAINNET.musd, reserve: parseUnits("3570", 18), decimals: 18 },
      ],
      { btcUsd: 80_000, mezoUsd: 0.00297 },
    );
    expect(tvl).toBeCloseTo(5_794.8, 0);
  });

  it("respects 6-decimal stablecoins", () => {
    const tvl = poolTvlUsd(
      [
        { address: "0x04671C72Aab5AC02A03c1098314b1BB6B560c197", reserve: 4_807_116_851n, decimals: 6 },
        { address: MAINNET.musd, reserve: parseUnits("6843.79246120057", 18), decimals: 18 },
      ],
      { btcUsd: 80_000, mezoUsd: 0.00297 },
    );
    expect(tvl).toBeCloseTo(11_650.9, 0);
  });
});

describe("roundTripCostUsd", () => {
  it("prices both chains' gas live; 24 Oct prices give well under $1", () => {
    const r = roundTripCostUsd({
      ethGasPriceWei: parseUnits("0.47", 9),
      ethPriceUsd: 2366,
      mezoGasPriceWei: parseUnits("0.0014625", 9),
      btcPriceUsd: 80_478,
    });
    // 1,150,000 × 0.47 gwei × $2,366 ≈ $1.28; Mezo side ≈ $0.06
    expect(r.usd).toBeGreaterThan(1.2);
    expect(r.usd).toBeLessThan(1.5);
    expect(r.basis).toMatch(/est\./);
  });
});

describe("Mezo source caching", () => {
  // A cached function's arguments are its cache key. The MEZO price used to be one, so each Merkl price tick
  // forced a fresh, blocking set of chain reads and the home page sat on its loading state.
  it("the cached chain read takes no arguments", () => {
    expect(readMezo.length).toBe(0);
  });

  it("applies the MEZO price after the cached read, so a new price needs no new chain reads", () => {
    const chain: MezoChain = {
      now: "2026-10-26T00:00:00.000Z",
      btcPrice: 80_000,
      borrow: { feePct: 0.1, gasCompensation: 200, minNetDebt: 1800, ratePct: 1 },
      paramsLive: true,
      spDeposits: 14_200_000,
      gasPriceWei: "1",
      pools: [
        {
          address: "0x0000000000000000000000000000000000000001",
          name: "Mezo pool MEZO/MUSD-200",
          kind: "Concentrated volatile",
          tokens: [
            { address: MAINNET.mezo, reserve: parseUnits("1000000", 18).toString(), decimals: 18 },
            { address: MAINNET.musd, reserve: parseUnits("5000", 18).toString(), decimals: 18 },
          ],
        },
      ],
    };
    const tvlAt = (price: number) => mezoVenues(chain, price).venues.find((v) => v.name.includes("MEZO/"))!.tvlUsd;
    expect(tvlAt(0.005)).toBeCloseTo(10_000, 6);
    expect(tvlAt(0.006)).toBeCloseTo(11_000, 6);
  });
});

describe("Mezo app pool rates", () => {
  it("reads basis points and drops anything that is not a sane number", () => {
    const r = parseMezoPools([
      { address: "0xCC372B7E15535aB225fe17c1075831D38ef7aC1a", stats: { apr: 9 }, emissionsApr: 181 },
      { address: "0xbad", stats: { apr: -1 }, emissionsApr: 5 },
      { address: 7, stats: { apr: 1 }, emissionsApr: 1 },
    ]);
    expect(r).toEqual({ "0xcc372b7e15535ab225fe17c1075831d38ef7ac1a": { feeApr: 0.09, emissionsApr: 1.81 } });
  });
});

describe("Mezo pools with the Mezo app's rates", () => {
  const pool = (address: string, name: string, kind: string) => ({ address, name, kind, tokens: [{ address: MAINNET.musd, reserve: (10n ** 24n).toString(), decimals: 18 }] });
  const chain: MezoChain = {
    now: "2026-10-26T00:00:00.000Z", btcPrice: 80_000, borrow: { feePct: 0.1, gasCompensation: 200, minNetDebt: 1800, ratePct: 1 },
    paramsLive: true, spDeposits: 1, gasPriceWei: "1",
    pools: [pool("0x00000000000000000000000000000000000000aa", "Mezo pool mUSDC/MUSD-10", "Concentrated stable"), pool("0x00000000000000000000000000000000000000bb", "Mezo pool BTC/MUSD", "Basic volatile")] as MezoChain["pools"],
  };
  const aprs = { "0x00000000000000000000000000000000000000aa": { feeApr: 0.09, emissionsApr: 1.81 }, "0x00000000000000000000000000000000000000bb": { feeApr: 1.54, emissionsApr: 82.21 } };
  const v = mezoVenues(chain, 0.005, aprs).venues;
  it("a stable pool is ranked at the better of fees or staked MEZO, not both", () => {
    const s = v.find((x) => x.name.includes("mUSDC"))!;
    expect(s.rates).toMatchObject({ liquidApr: 0, emissionsApr: 1.81 });
    expect(s.tags).toContain("Paid in MEZO when staked (liquid, price moves)");
  });
  it("a BTC pair stays unranked (it needs BTC too) but shows the Mezo app's rates", () => {
    const b = v.find((x) => x.name.includes("BTC/"))!;
    expect(b.rates.liquidApr).toBeNull();
    expect(b.tags).toContain("Mezo app: 1.54% fees, or 82.21% in MEZO staked");
  });
  it("without the Mezo app's rates the pools stay size-only, as before", () => {
    expect(mezoVenues(chain, 0.005).venues.every((x) => x.rates.liquidApr === null)).toBe(true);
  });
});
