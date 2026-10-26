import { formatUnits } from "viem";

/** MEZO a staked position earns a year, in % at MEZO spot: rewardRate × a year × price ÷ staked value. 0 once the period ended.
 *  Its own module so client code (My MUSD) can use it without pulling in the cached server reads. */
export function gaugeAprPct(rewardRate: bigint, stakedUsd: number, periodFinish: bigint, nowSec: number, mezoUsd: number): number {
  if (stakedUsd <= 0 || Number(periodFinish) <= nowSec) return 0;
  return ((Number(formatUnits(rewardRate, 18)) * 31_536_000 * mezoUsd) / stakedUsd) * 100;
}
