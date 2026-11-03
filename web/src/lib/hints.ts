import { zeroAddress, type Address, type PublicClient } from "viem";
import { hintHelpersAbi, sortedTrovesAbi } from "@/lib/chain/abis";
import { NETWORKS, type NetworkId } from "@/lib/chain/addresses";

/** The value SortedTroves sorts by (highest first): collateral ÷ debt, no price. HintHelpers.computeNominalCR does the same. */
export const nominalIcr = (collateral: bigint, debt: bigint): bigint => (collateral * 10n ** 20n) / debt;

/**
 * Where a new trove sits in SortedTroves, so openTrove does not walk the whole list.
 * A wrong hint only costs gas, so any read failure returns zero hints and says so.
 */
export async function getTroveHints(
  client: PublicClient,
  network: NetworkId,
  { debt, collateral }: { debt: bigint; collateral: bigint },
): Promise<{ upper: Address; lower: Address; usedFallback: boolean }> {
  if (debt <= 0n) throw new Error("A trove's debt must be above zero.");
  const net = NETWORKS[network];
  const nicr = nominalIcr(collateral, debt);
  try {
    const size = await client.readContract({ address: net.sortedTroves, abi: sortedTrovesAbi, functionName: "getSize" });
    if (size === 0n) return { upper: zeroAddress, lower: zeroAddress, usedFallback: false };
    const trials = BigInt(Math.ceil(15 * Math.sqrt(Number(size)))); // HintHelpers' own advice: k·√length with k = 15
    const [hint] = await client.readContract({ address: net.hintHelpers, abi: hintHelpersAbi, functionName: "getApproxHint", args: [nicr, trials, 42n] });
    const [upper, lower] = await client.readContract({ address: net.sortedTroves, abi: sortedTrovesAbi, functionName: "findInsertPosition", args: [nicr, hint, hint] });
    return { upper, lower, usedFallback: false };
  } catch {
    return { upper: zeroAddress, lower: zeroAddress, usedFallback: true };
  }
}
