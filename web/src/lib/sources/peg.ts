import { cacheLife } from "next/cache";
import { formatUnits } from "viem";
import { borrowerOperationsAbi, clPoolAbi } from "@/lib/chain/abis";
import { MAINNET } from "@/lib/chain/addresses";
import { mezoClient } from "@/lib/chain/clients";

export type Peg = { priceUsd: number; floorUsd: number; redemptionPct: number; pool: string; updatedAt: string };

/** MUSD price in mUSDC for the MUSD/mUSDC pool (token0 mUSDC 6 decimals, token1 MUSD 18): 1 / (sqrt² / 2^192 × 10^(6-18)).
 *  Bigint until the last division, scaled by 1e8. */
export function musdPriceFromSqrtPriceX96(sqrtPriceX96: bigint): number {
  return Number((2n ** 192n * 10n ** 20n) / sqrtPriceX96 ** 2n) / 1e8;
}

/** Read on Mezo mainnet, 8 Nov 2026 (docs/research/2026-11-wave2b-venues-peg.md). Assumes mUSDC = $1. */
export async function readPeg(): Promise<Peg> {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 86_400 }); // see the note in merkl.ts
  const [slot, rate] = await Promise.all([
    mezoClient.readContract({ address: MAINNET.pools.musdcMusdCl10, abi: clPoolAbi, functionName: "slot0" }),
    mezoClient.readContract({ address: MAINNET.borrowerOperations, abi: borrowerOperationsAbi, functionName: "redemptionRate" }),
  ]);
  const priceUsd = musdPriceFromSqrtPriceX96(slot[0]);
  if (!(priceUsd >= 0.5 && priceUsd <= 1.5)) throw new Error(`implausible MUSD price ${priceUsd}`);
  const fee = Number(formatUnits(rate, 18));
  return { priceUsd, floorUsd: 1 - fee, redemptionPct: fee * 100, pool: MAINNET.pools.musdcMusdCl10, updatedAt: new Date().toISOString() };
}
