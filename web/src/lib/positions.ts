import { formatUnits, type Address, type PublicClient } from "viem";
import {
  erc20Abi,
  smusdAbi,
  stabilityPoolAbi,
  troveManagerAbi,
} from "@/lib/chain/abis";
import { MAINNET } from "@/lib/chain/addresses";
import { buildYields, type Sources, type VenueOut } from "@/lib/yields";

/** Where one address's MUSD sits on Mezo mainnet (amounts in MUSD). */
export type Positions = {
  address: Address;
  wallet: number; // idle MUSD in the wallet
  vault: number; // Savings Vault (1 sMUSD = 1 MUSD)
  staked: number | null; // sMUSD staked in the vault's gauge; null if the gauge could not be read
  stability: number; // Stability Pool deposit after liquidations
  trove: { debt: number; ratePct: number } | null; // null when the address has no active trove
  veMezo: { unclaimed: number; usd: number | null } | null; // null when Merkl did not answer
};

const f = (v: bigint) => Number(formatUnits(v, 18));

export async function readPositions(
  client: PublicClient,
  address: Address,
): Promise<Omit<Positions, "veMezo">> {
  const tm = { address: MAINNET.troveManager, abi: troveManagerAbi } as const;
  const [wallet, vault, staked, stability, status, all, rate] =
    await Promise.all([
      client.readContract({
        address: MAINNET.musd,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      }),
      client.readContract({
        address: MAINNET.smusd,
        abi: smusdAbi,
        functionName: "balanceOf",
        args: [address],
      }),
      // The gauge is a separate contract; a failed read leaves this position out instead of failing the answer.
      client
        .readContract({
          address: MAINNET.smusdGauge,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        })
        .catch(() => null),
      client.readContract({
        address: MAINNET.stabilityPool,
        abi: stabilityPoolAbi,
        functionName: "getCompoundedMUSDDeposit",
        args: [address],
      }),
      client.readContract({
        ...tm,
        functionName: "getTroveStatus",
        args: [address],
      }),
      client.readContract({
        ...tm,
        functionName: "getEntireDebtAndColl",
        args: [address],
      }),
      client.readContract({
        ...tm,
        functionName: "getTroveInterestRate",
        args: [address],
      }),
    ]);
  const [, principal, interest, , pendingPrincipal, pendingInterest] = all;
  return {
    address,
    wallet: f(wallet),
    vault: f(vault),
    staked: staked === null ? null : f(staked),
    stability: f(stability),
    trove:
      status === 1
        ? {
            debt: f(principal + interest + pendingPrincipal + pendingInterest),
            ratePct: rate / 100,
          }
        : null,
  };
}

export type Row = {
  id: "wallet" | "vault" | "staked" | "stability";
  label: string;
  amount: number;
  nowPct: number | null; // cash it earns today; null = no steady APR
  best: VenueOut;
  extraPerYear: number | null; // MUSD a year more at the best place; 0 when already there
};

const LABELS: Record<Row["id"], string> = {
  wallet: "Idle in your wallet",
  vault: "Savings Vault",
  staked: "Savings Vault, staked in the gauge",
  stability: "Stability Pool",
};

/** Each holding next to the best cash place for that same amount (holder, 90-day hold). */
export function compare(p: Positions, sources: Sources): Row[] {
  const vaultApr =
    sources.venues.find(
      (v) => v.id === sources.benchmarkId && v.status === "ok",
    )?.rates.liquidApr ?? null;
  const held: [Row["id"], number, number | null][] = [
    ["wallet", p.wallet, 0],
    ["vault", p.vault, vaultApr],
    ["staked", p.staked ?? 0, vaultApr],
    ["stability", p.stability, null],
  ];
  return held
    .filter(([, amount]) => amount >= 1)
    .flatMap(([id, amount, nowPct]) => {
      const best = buildYields(sources, {
        amount,
        mode: "holder",
        trove: "new",
        days: 90,
        ratePct: null,
      }).venues.find((v) => v.carry.cash !== null);
      if (!best) return [];
      const extra =
        nowPct === null
          ? null
          : Math.max(0, (amount * (best.carry.cash! - nowPct)) / 100);
      return [
        { id, label: LABELS[id], amount, nowPct, best, extraPerYear: extra },
      ];
    });
}
