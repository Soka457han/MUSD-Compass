import { cacheLife } from "next/cache";
import { formatUnits, getAddress, parseAbi, type Address } from "viem";
import { MAINNET } from "@/lib/chain/addresses";
import { mezoClient } from "@/lib/chain/clients";
import type { Venue } from "@/lib/venue";

/** Mezo's own Morpho Blue deployment (owner: Mezo multisig; per Surety's and Baserate's docs, checked on chain 8 Nov 2026). */
export const MORPHO_BLUE = "0x565834cE7E40b8987BC20EbF83E2159467bDA311" as const;
/** Known MUSD markets on it. Source: Surety's deployment file, github.com/RaYYeR220/surety, contracts/deployments/31612.json. */
export const MORPHO_MARKET_IDS = ["0x29c2a844b71bb5db40ca26e8880552dcd40517aa10e945b15ef616c46d5d6707"] as const;

const morphoAbi = parseAbi([
  "function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)",
  "function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)",
]);
const irmAbi = parseAbi([
  "function borrowRateView((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee) market) view returns (uint256)",
]);

const YEAR_SECONDS = 31_536_000;

/** Borrow APY in percent from the IRM's per-second WAD rate. */
export const borrowApyPct = (ratePerSecWad: bigint) => Math.expm1((Number(ratePerSecWad) / 1e18) * YEAR_SECONDS) * 100;

/** What lenders earn in percent: borrow APY × utilization × (1 − fee). 0 when nothing is supplied. */
export function morphoSupplyApyPct(ratePerSecWad: bigint, supplied: number, borrowed: number, feeWad: bigint): number {
  if (!(supplied > 0)) return 0;
  return borrowApyPct(ratePerSecWad) * (borrowed / supplied) * (1 - Number(feeWad) / 1e18);
}

/** One market's raw reads as strings so the cached value stays plain data; `rate` is null when the IRM read failed. */
export type MorphoRead = { id: string; loanToken: string; supplied: string; borrowed: string; fee: string; rate: string | null; now: string };

export async function readMorpho(): Promise<MorphoRead[]> {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 86_400 }); // see the note in merkl.ts
  const now = new Date().toISOString();
  return Promise.all(
    MORPHO_MARKET_IDS.map(async (id) => {
      const [[loanToken, collateralToken, oracle, irm, lltv], [totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, lastUpdate, fee]] = await Promise.all([
        mezoClient.readContract({ address: MORPHO_BLUE, abi: morphoAbi, functionName: "idToMarketParams", args: [id] }),
        mezoClient.readContract({ address: MORPHO_BLUE, abi: morphoAbi, functionName: "market", args: [id] }),
      ]);
      let rate: string | null = null;
      try {
        const r = await mezoClient.readContract({
          address: irm as Address,
          abi: irmAbi,
          functionName: "borrowRateView",
          args: [{ loanToken, collateralToken, oracle, irm, lltv }, { totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, lastUpdate, fee }],
        });
        rate = r.toString();
      } catch (error) {
        console.error(`[sources] morpho IRM rate of ${id} failed:`, error); // the market is still listed, without a rate
      }
      return { id, loanToken, supplied: totalSupplyAssets.toString(), borrowed: totalBorrowAssets.toString(), fee: fee.toString(), rate, now };
    }),
  );
}

const SOURCE = { label: "Mezo chain: Morpho Blue", url: `https://explorer.mezo.org/address/${MORPHO_BLUE}` };
const ACTION = { label: "Lend through Surety", url: "https://surety-credit.vercel.app" };

/** The listing for each MUSD market; markets whose loan token is not MUSD are skipped. */
export function morphoVenues(reads: MorphoRead[]): Venue[] {
  return reads
    .filter((m) => getAddress(m.loanToken) === getAddress(MAINNET.musd))
    .map((m): Venue => {
      const supplied = Number(formatUnits(BigInt(m.supplied), 18));
      const borrowed = Number(formatUnits(BigInt(m.borrowed), 18));
      const rate = m.rate === null ? null : BigInt(m.rate);
      const live = supplied > 0 && rate !== null;
      const util = supplied > 0 ? (borrowed / supplied) * 100 : 0;
      return {
        id: `mezo-morpho-${m.id.slice(0, 10)}`,
        name: "Morpho Blue BTC/MUSD (Surety's market)",
        chain: "Mezo",
        rates: { liquidApr: live ? morphoSupplyApyPct(rate, supplied, borrowed, BigInt(m.fee)) : null, lockedApr: null, fixedCostUsd: 0, tvl: supplied },
        tvlUsd: supplied,
        ends: null,
        action: ACTION,
        source: SOURCE,
        routes: [],
        tags: ["Mezo-native", "Lending", "No MEZO rewards"],
        notes: [
          ...(supplied === 0 ? ["Nothing supplied yet: the rate appears once MUSD is lent here."] : []),
          `Lenders earn the interest borrowers pay on Mezo's own Morpho Blue; borrow APY ${rate === null ? "unavailable" : `${borrowApyPct(rate).toFixed(2)}%`}, utilization ${util.toFixed(1)}%.`,
          "Market created by Surety; lend through Surety's vault.",
        ],
        status: "ok",
        updatedAt: m.now,
      };
    });
}
