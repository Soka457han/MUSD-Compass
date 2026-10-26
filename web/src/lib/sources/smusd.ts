import { cacheLife } from "next/cache";
import { formatUnits, type PublicClient } from "viem";
import { smusdAbi } from "@/lib/chain/abis";
import { MAINNET, TESTNET } from "@/lib/chain/addresses";
import { mezoClient, mezoTestnetClient } from "@/lib/chain/clients";
import type { Venue } from "@/lib/venue";

export type YieldEvent = { kind: string; blockNumber: number; timestamp: number; amount: string };

/** Realised APR from distributed yield. sMUSD pays weekly (Thu ~00:20 UTC), so a 14-day window always
 *  spans two distributions and is not thrown off by one landing a few minutes early or late. */
export const APR_WINDOW_DAYS = 14;

export function realisedApr(events: YieldEvent[], totalSupplyWei: string, nowTs: number, days = APR_WINDOW_DAYS) {
  const cutoff = nowTs - days * 86_400;
  const inWindow = events.filter((e) => e.timestamp > cutoff);
  const yieldWei = inWindow.reduce((s, e) => s + BigInt(e.amount), 0n);
  const supply = BigInt(totalSupplyWei);
  const aprPct = supply === 0n ? 0 : (Number(formatUnits(yieldWei, 18)) / Number(formatUnits(supply, 18))) * 100 * (365 / days);
  const last = events.reduce<number | null>((m, e) => (m === null || e.timestamp > m ? e.timestamp : m), null);
  return { aprPct, yieldMusd: Number(formatUnits(yieldWei, 18)), events: inWindow.length, lastDistribution: last };
}

const MAX_SPAN = 10_000n; // Mezo RPCs reject wider eth_getLogs ranges ("maximum [from, to] blocks distance: 10000")
const CONCURRENCY = 8; // calls made together go out as one JSON-RPC batch (Boar takes 40 per request), so 8 is still one request at a time

async function pool<T>(jobs: (() => Promise<T>)[], size: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        out[i] = await jobs[i]();
      }
    }),
  );
  return out;
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let k = 1; ; k++) {
    try {
      return await fn();
    } catch (e) {
      if (k >= tries) throw e;
      await new Promise((r) => setTimeout(r, 400 * k));
    }
  }
}

/** Reads yield events for the last `days` days in ≤10k-block windows. */
export async function scanYieldEvents(client: PublicClient, address: `0x${string}`, days: number) {
  const head = await client.getBlock();
  const earlier = await client.getBlock({ blockNumber: head.number - 100_000n });
  const secondsPerBlock = Number(head.timestamp - earlier.timestamp) / 100_000;
  const span = BigInt(Math.ceil((days * 86_400) / secondsPerBlock));
  const start = head.number - span;
  const ranges: [bigint, bigint][] = [];
  for (let from = start; from <= head.number; from += MAX_SPAN) {
    const to = from + MAX_SPAN - 1n > head.number ? head.number : from + MAX_SPAN - 1n;
    ranges.push([from, to]);
  }
  const events = smusdAbi.filter((x) => x.type === "event");
  const chunks = await pool(
    ranges.map(([fromBlock, toBlock]) => () => withRetry(() => client.getLogs({ address, events, fromBlock, toBlock }))),
    CONCURRENCY,
  );
  const logs = chunks.flat();
  const stamps = new Map<bigint, number>();
  for (const l of logs) {
    if (!stamps.has(l.blockNumber)) {
      const b = await withRetry(() => client.getBlock({ blockNumber: l.blockNumber }));
      stamps.set(l.blockNumber, Number(b.timestamp));
    }
  }
  const out: YieldEvent[] = logs.map((l) => ({
    kind: l.eventName,
    blockNumber: Number(l.blockNumber),
    timestamp: stamps.get(l.blockNumber)!,
    amount: (l.args.amount ?? 0n).toString(),
  }));
  return { nowTs: Number(head.timestamp), events: out };
}

export type SmusdData = { venue: Venue; events: YieldEvent[]; aprPct: number; lastDistribution: number | null };

export async function fetchSmusdMainnet(): Promise<SmusdData> {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 86_400 }); // after 5 min a visit gets the cached copy at once and refreshes it in the background; only a full day without visits makes one wait
  const client = mezoClient as PublicClient;
  const [scan, supply] = await Promise.all([
    scanYieldEvents(client, MAINNET.smusd, APR_WINDOW_DAYS),
    client.readContract({ address: MAINNET.smusd, abi: smusdAbi, functionName: "totalSupply" }),
  ]);
  const r = realisedApr(scan.events, supply.toString(), scan.nowTs);
  return {
    aprPct: r.aprPct,
    lastDistribution: r.lastDistribution,
    events: scan.events,
    venue: {
      id: "mezo-smusd",
      name: "MUSD Savings Vault (sMUSD)",
      chain: "Mezo",
      rates: { liquidApr: r.aprPct, lockedApr: 0, fixedCostUsd: 0, tvl: null },
      tvlUsd: Number(formatUnits(supply, 18)),
      ends: null,
      action: { label: "Deposit (testnet)", url: "/vault" },
      source: { label: "Mezo chain — yield events", url: `https://explorer.mezo.org/address/${MAINNET.smusd}` },
      routes: [],
      tags: ["Mezo-native", "No lock, no withdrawal fee", "Variable yield"],
      notes: [
        `Realised APR: yield paid in the last ${APR_WINDOW_DAYS} days ÷ supply, annualised.`,
        "Staking sMUSD in the Mezo gauge swaps this fee yield for MEZO emissions — see the Mezo app. Never both.",
      ],
      status: "ok",
      updatedAt: new Date().toISOString(),
    },
  };
}

/** Testnet: only the last distribution time is needed (for the vault page). */
export async function fetchSmusdTestnetLastDistribution(): Promise<number | null> {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 86_400 }); // after 5 min a visit gets the cached copy at once and refreshes it in the background; only a full day without visits makes one wait
  const scan = await scanYieldEvents(mezoTestnetClient as PublicClient, TESTNET.smusd, APR_WINDOW_DAYS);
  return realisedApr(scan.events, "1", scan.nowTs).lastDistribution;
}
