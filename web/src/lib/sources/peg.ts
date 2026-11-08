import { cacheLife } from "next/cache";
import { encodeFunctionData, formatUnits } from "viem";
import { decodeLiquidityNet, musdSellDepth } from "@/lib/depth";
import { borrowerOperationsAbi, clPoolAbi } from "@/lib/chain/abis";
import { MAINNET } from "@/lib/chain/addresses";
import { mezoClient } from "@/lib/chain/clients";

export type Peg = { priceUsd: number; floorUsd: number; redemptionPct: number; pool: string; updatedAt: string;
  /** MUSD the pool absorbs before MUSD falls below depthFloorUsd, and the mUSDC it pays out; null when the tick read failed. */
  depthMusd: number | null; depthUsdc: number | null; depthFloorUsd: number };

const DEPTH_FLOOR_USD = 0.99;

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
  const depth = await readDepth(slot[0], slot[1]).catch(() => null); // the peg line must show even when this fails
  return {
    priceUsd, floorUsd: 1 - fee, redemptionPct: fee * 100, pool: MAINNET.pools.musdcMusdCl10, updatedAt: new Date().toISOString(),
    depthMusd: depth?.musd ?? null, depthUsdc: depth?.usdc ?? null, depthFloorUsd: DEPTH_FLOOR_USD,
  };
}

async function readDepth(sqrtPriceX96: bigint, tick: number) {
  const address = MAINNET.pools.musdcMusdCl10;
  const [liquidity, tickSpacing] = await Promise.all([
    mezoClient.readContract({ address, abi: clPoolAbi, functionName: "liquidity" }),
    mezoClient.readContract({ address, abi: clPoolAbi, functionName: "tickSpacing" }),
  ]);
  const spacing = Number(tickSpacing);
  const first = (Math.floor(tick / spacing) + 1) * spacing;
  const ticks = Array.from({ length: 50 }, (_, i) => first + i * spacing);
  // Slipstream's ticks() returns 10 words, not Uniswap V3's 8: raw call, decode only liquidityNet.
  const nets = await Promise.all(ticks.map(async (t) => {
    const { data } = await mezoClient.call({ to: address, data: encodeFunctionData({ abi: clPoolAbi, functionName: "ticks", args: [t] }) });
    return decodeLiquidityNet(data ?? "0x");
  }));
  const liquidityNet = new Map(ticks.map((t, i) => [t, nets[i]]));
  return musdSellDepth({ sqrtPriceX96, tick, liquidity, tickSpacing: spacing, liquidityNet }, DEPTH_FLOOR_USD);
}
