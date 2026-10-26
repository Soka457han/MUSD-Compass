import { cacheLife } from "next/cache";
import { formatUnits, getAddress, type Address } from "viem";
import type { BorrowParams } from "@/lib/carry/carry";
import { borrowerOperationsAbi, erc20Abi, interestRateManagerAbi, poolAbi, priceFeedAbi, stabilityPoolAbi } from "@/lib/chain/abis";
import { MAINNET } from "@/lib/chain/addresses";
import { mezoClient } from "@/lib/chain/clients";
import type { Venue } from "@/lib/venue";

// Values read live on 24 Oct 2026; used only if the chain read fails.
export const FALLBACK_BORROW_PARAMS: BorrowParams & { ratePct: number } = { feePct: 0.1, gasCompensation: 200, minNetDebt: 1800, ratePct: 1 };

/** BorrowerOperations.borrowingRate is a fraction in 1e18 (1e15 = 0.1%); InterestRateManager.interestRate is in bps. */
export function toBorrowParams(raw: { minNetDebt: bigint; borrowingRate: bigint; gasCompensation: bigint; interestRateBps: number }) {
  return {
    minNetDebt: Number(formatUnits(raw.minNetDebt, 18)),
    feePct: Number(formatUnits(raw.borrowingRate, 18)) * 100,
    gasCompensation: Number(formatUnits(raw.gasCompensation, 18)),
    ratePct: raw.interestRateBps / 100,
  };
}

/** USD value of a pool's token balances. MUSD and Mezo's bridged stablecoins count as $1;
 *  BTC uses the PriceFeed, MEZO the Merkl price. Works for basic and concentrated pools alike. */
export function poolTvlUsd(
  tokens: { address: string; reserve: bigint; decimals: number }[],
  prices: { btcUsd: number; mezoUsd: number },
): number {
  return tokens.reduce((sum, t) => {
    const amount = Number(formatUnits(t.reserve, t.decimals));
    const a = getAddress(t.address);
    const price = a === getAddress(MAINNET.btc) ? prices.btcUsd : a === getAddress(MAINNET.mezo) ? prices.mezoUsd : 1;
    return sum + amount * price;
  }, 0);
}

export type MezoData = { venues: Venue[]; borrow: ReturnType<typeof toBorrowParams>; btcPriceUsd: number; gasPriceWei: string; paramsLive: boolean };

const POOLS: { address: Address; name: string; kind: string }[] = [
  { address: MAINNET.pools.musdcMusdCl10, name: "Mezo pool mUSDC/MUSD-10", kind: "Concentrated stable" },
  { address: MAINNET.pools.btcMusd, name: "Mezo pool BTC/MUSD", kind: "Basic volatile" },
  { address: MAINNET.pools.btcMusdCl200, name: "Mezo pool BTC/MUSD-200", kind: "Concentrated volatile" },
  { address: MAINNET.pools.musdMusdt, name: "Mezo pool MUSD/mUSDT", kind: "Basic stable" },
  { address: MAINNET.pools.musdcMusd, name: "Mezo pool mUSDC/MUSD", kind: "Basic stable" },
  { address: MAINNET.pools.mezoMusdCl200, name: "Mezo pool MEZO/MUSD-200", kind: "Concentrated volatile" },
];

async function readPool(address: Address) {
  const [t0, t1] = await Promise.all([
    mezoClient.readContract({ address, abi: poolAbi, functionName: "token0" }),
    mezoClient.readContract({ address, abi: poolAbi, functionName: "token1" }),
  ]);
  return Promise.all(
    [t0, t1].map(async (t) => ({
      address: t,
      reserve: await mezoClient.readContract({ address: t, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
      decimals: await mezoClient.readContract({ address: t, abi: erc20Abi, functionName: "decimals" }),
    })),
  );
}

export type MezoChain = Awaited<ReturnType<typeof readMezo>>;

/** A pool's two rates in the Mezo app, in %: trading fees for unstaked LP, MEZO emissions for LP staked in the gauge. */
export type MezoPoolApr = { feeApr: number; emissionsApr: number };

const bps = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 10_000_000 ? n / 100 : null);

/** api.mezo.org/pools gives both rates in basis points (9 = 0.09%, checked against mezo.org/earn/pools on 26 Oct). */
export function parseMezoPools(data: { address?: unknown; emissionsApr?: unknown; stats?: { apr?: unknown } }[]): Record<string, MezoPoolApr> {
  const out: Record<string, MezoPoolApr> = {};
  for (const p of data) {
    const fee = bps(p.stats?.apr);
    const em = bps(p.emissionsApr);
    if (typeof p.address === "string" && fee !== null && em !== null) out[p.address.toLowerCase()] = { feeApr: fee, emissionsApr: em };
  }
  return out;
}

/** The endpoint the Mezo app's pools page reads. Not a documented API, so a failure only leaves pools unranked. */
export async function fetchMezoPoolAprs(): Promise<Record<string, MezoPoolApr>> {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 86_400 });
  const r = await fetch("https://api.mezo.org/pools?filter=known%2Ctvl", { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`api.mezo.org/pools → HTTP ${r.status}`);
  const j = (await r.json()) as { data?: unknown };
  if (!Array.isArray(j.data)) throw new Error("api.mezo.org/pools: no data array");
  return parseMezoPools(j.data);
}

/** Everything read from the Mezo chain, cached on its own. It takes no arguments on purpose: a cached function's
 *  arguments are part of its cache key, and the MEZO price used to be one, so every Merkl price tick forced a fresh
 *  (slow, blocking) set of chain reads. Prices are applied afterwards in mezoVenues(). */
export async function readMezo() {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 86_400 }); // see the note in merkl.ts
  const now = new Date().toISOString();
  const btcPrice = Number(formatUnits(await mezoClient.readContract({ address: MAINNET.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" }), 18));

  let borrow = FALLBACK_BORROW_PARAMS;
  let paramsLive = true;
  try {
    const [minNetDebt, borrowingRate, gasCompensation, interestRateBps] = await Promise.all([
      mezoClient.readContract({ address: MAINNET.borrowerOperations, abi: borrowerOperationsAbi, functionName: "minNetDebt" }),
      mezoClient.readContract({ address: MAINNET.borrowerOperations, abi: borrowerOperationsAbi, functionName: "borrowingRate" }),
      mezoClient.readContract({ address: MAINNET.borrowerOperations, abi: borrowerOperationsAbi, functionName: "MUSD_GAS_COMPENSATION" }),
      mezoClient.readContract({ address: MAINNET.interestRateManager, abi: interestRateManagerAbi, functionName: "interestRate" }),
    ]);
    borrow = toBorrowParams({ minNetDebt, borrowingRate, gasCompensation, interestRateBps });
  } catch {
    paramsLive = false;
  }

  const [spDeposits, pools, gasPrice] = await Promise.all([
    mezoClient.readContract({ address: MAINNET.stabilityPool, abi: stabilityPoolAbi, functionName: "getTotalMUSDDeposits" }),
    Promise.all(POOLS.map(async (p) => ({ ...p, tokens: (await readPool(p.address)).map((t) => ({ ...t, reserve: t.reserve.toString() })) }))),
    mezoClient.getGasPrice(),
  ]);
  return { now, btcPrice, borrow, paramsLive, spDeposits: Number(formatUnits(spDeposits, 18)), pools, gasPriceWei: gasPrice.toString() };
}

/** Builds the Mezo venues from the cached chain read and today's MEZO price. */
export function mezoVenues(chain: MezoChain, mezoPriceUsd: number, aprs: Record<string, MezoPoolApr> | null = null): MezoData {
  const { now, btcPrice, borrow, paramsLive, spDeposits } = chain;
  const pools = chain.pools.map((p) => ({ ...p, tvl: poolTvlUsd(p.tokens.map((t) => ({ ...t, reserve: BigInt(t.reserve) })), { btcUsd: btcPrice, mezoUsd: mezoPriceUsd }) }));

  const venues: Venue[] = [
    {
      id: "mezo-stability-pool",
      name: "Stability Pool",
      chain: "Mezo",
      rates: { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl: spDeposits },
      tvlUsd: spDeposits,
      ends: null,
      action: { label: "About the Stability Pool", url: "https://mezo.org/docs/users/musd/" },
      source: { label: "Mezo chain", url: `https://explorer.mezo.org/address/${MAINNET.stabilityPool}` },
      routes: [],
      tags: ["No direct incentives", "Lumpy: earns only on liquidations"],
      notes: ["Protocol-seeded. Earns discounted BTC only when troves are liquidated, so it has no steady APR."],
      status: "ok",
      updatedAt: now,
    },
    ...pools.map((p): Venue => {
      const a = aprs?.[p.address.toLowerCase()];
      // Only stable pairs are a place for MUSD alone; a BTC or MEZO pair needs that token too, so it stays unranked.
      const ranked = a && p.kind.includes("stable");
      const staked = a ? a.emissionsApr >= a.feeApr : false; // staked LP earns MEZO, and its fees go to voters: the better of the two
      const p2 = (n: number) => `${n.toFixed(2)}%`;
      return {
        id: `mezo-pool-${p.address.toLowerCase()}`,
        name: p.name,
        chain: "Mezo",
        rates: ranked
          ? { liquidApr: staked ? 0 : a.feeApr, lockedApr: null, fixedCostUsd: 0, tvl: p.tvl, emissionsApr: staked ? a.emissionsApr : null }
          : { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl: p.tvl },
        tvlUsd: p.tvl,
        ends: null,
        action: { label: a ? "Add liquidity in the Mezo app" : "See APR in the Mezo app", url: "https://mezo.org/earn/pools" },
        source: a ? { label: "Mezo app (api.mezo.org/pools)", url: "https://mezo.org/earn/pools" } : { label: "Mezo chain — pool reserves", url: `https://explorer.mezo.org/address/${p.address}` },
        routes: [],
        tags: [
          "Mezo-native",
          p.kind,
          ...(p.name.includes("BTC") ? ["BTC price exposure"] : []),
          ...(p.name.includes("MEZO/") ? ["MEZO price exposure"] : []),
          ...(a ? [ranked ? (staked ? `Paid in MEZO when staked (liquid, price moves)` : "Trading fees") : `Mezo app: ${p2(a.feeApr)} fees, or ${p2(a.emissionsApr)} in MEZO staked`] : []),
        ],
        notes: a
          ? [
              `Mezo app today: ${p2(a.feeApr)} trading fees unstaked, or ${p2(a.emissionsApr)} in MEZO with the LP staked in its gauge (staking hands the fees to voters). Compass uses the higher one.`,
              ...(p.kind.startsWith("Concentrated") ? ["Concentrated pool: your rate depends on the price range you pick."] : []),
            ]
          : ["The Mezo app shows this pool's fee APR and emissions APR; Compass shows its size and links there."],
        status: "ok",
        updatedAt: now,
      };
    }),
  ];

  return { venues, borrow, btcPriceUsd: btcPrice, gasPriceWei: chain.gasPriceWei, paramsLive };
}
