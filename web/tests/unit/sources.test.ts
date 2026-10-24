import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import { poolTvlUsd, toBorrowParams } from "@/lib/sources/mezo";
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
