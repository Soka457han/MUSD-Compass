import { formatUnits, type Address, type PublicClient } from "viem";
import { priceFeedAbi, sortedTrovesAbi, troveManagerAbi } from "@/lib/chain/abis";
import { MAINNET } from "@/lib/chain/addresses";

export const SAFE_ICR = 2; // 200 %: the planner's floor, well above Mezo's 110 % minimum

/** Extra MUSD you can borrow and keep ICR ≥ floor. The 0.1 % fee is added to the debt, so it counts too. */
export function safeExtraBorrow(collUsd: number, debt: number, feePct: number, floor = SAFE_ICR): number {
  return Math.max(0, (collUsd / floor - debt) / (1 + feePct / 100));
}

/** How many active troves are redeemed before this one (lower nominal ratio = redeemed first). */
export function redemptionPosition(nicrs: bigint[], mine: bigint): number {
  return nicrs.filter((n) => n < mine).length;
}

export type TroveView = {
  address: Address;
  active: boolean;
  collateralBtc: number;
  collateralUsd: number;
  debt: number; // principal + interest, incl. pending redistribution
  icrPct: number;
  ratePct: number;
  ahead: number | null; // troves redeemed before this one
  troves: number;
  recoveryMode: boolean;
  safeExtra: number;
  btcUsd: number;
};

const f = (v: bigint) => Number(formatUnits(v, 18));

/** Every active trove's nominal ICR (batched JSON-RPC; the caller caches it). */
export async function readNominalIcrs(client: PublicClient): Promise<bigint[]> {
  const tm = { address: MAINNET.troveManager, abi: troveManagerAbi } as const;
  const count = Number(await client.readContract({ ...tm, functionName: "getTroveOwnersCount" }));
  if (count > 3_000) throw new Error(`${count} troves: too many to scan in one request`); // the page then says "unavailable"
  // shortcut: reads every trove twice in batches; fine for today's few thousand troves, move to an indexer if it grows past ~10k.
  const owners = await Promise.all(Array.from({ length: count }, (_, i) => client.readContract({ ...tm, functionName: "getTroveFromTroveOwnersArray", args: [BigInt(i)] })));
  return Promise.all(owners.map((o) => client.readContract({ ...tm, functionName: "getNominalICR", args: [o] })));
}

export async function sampleTrove(client: PublicClient): Promise<Address> {
  return client.readContract({ address: MAINNET.sortedTroves, abi: sortedTrovesAbi, functionName: "getFirst" });
}

export async function readTrove(client: PublicClient, address: Address, feePct: number, nicrs: bigint[] | null): Promise<TroveView> {
  const tm = { address: MAINNET.troveManager, abi: troveManagerAbi } as const;
  const price = await client.readContract({ address: MAINNET.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" });
  const [status, all, icr, rate, nicr, recovery] = await Promise.all([
    client.readContract({ ...tm, functionName: "getTroveStatus", args: [address] }),
    client.readContract({ ...tm, functionName: "getEntireDebtAndColl", args: [address] }),
    client.readContract({ ...tm, functionName: "getCurrentICR", args: [address, price] }),
    client.readContract({ ...tm, functionName: "getTroveInterestRate", args: [address] }),
    client.readContract({ ...tm, functionName: "getNominalICR", args: [address] }),
    client.readContract({ ...tm, functionName: "checkRecoveryMode", args: [price] }),
  ]);
  const [coll, principal, interest, pendingColl, pendingPrincipal, pendingInterest] = all;
  const btcUsd = f(price);
  const collateralBtc = f(coll + pendingColl);
  const debt = f(principal + interest + pendingPrincipal + pendingInterest);
  const active = status === 1;
  return {
    address,
    active,
    collateralBtc,
    collateralUsd: collateralBtc * btcUsd,
    debt,
    icrPct: f(icr) * 100,
    ratePct: rate / 100,
    ahead: active && nicrs ? redemptionPosition(nicrs, nicr) : null,
    troves: nicrs?.length ?? 0,
    recoveryMode: recovery,
    safeExtra: active ? safeExtraBorrow(collateralBtc * btcUsd, debt, feePct) : 0,
    btcUsd,
  };
}
