import { cacheLife } from "next/cache";
import { formatUnits, getAddress, zeroAddress, type Address } from "viem";
import { gaugeAprPct } from "@/lib/gauge";
import type { BorrowParams } from "@/lib/carry/carry";
import { borrowerOperationsAbi, clPoolAbi, erc20Abi, erc4626Abi, interestRateManagerAbi, poolAbi, poolsVoterAbi, priceFeedAbi, stabilityPoolAbi, vaultGaugeAbi } from "@/lib/chain/abis";
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

/** What a pool's gauge pays staked LP right now, or null when there is no gauge, it has ended or nothing is staked.
 *  stakedUsd = pool TVL × staked share; apr is in percent, from the existing gaugeAprPct. */
export function gaugeEmissions(g: GaugeRead | null, tvlUsd: number, mezoUsd: number, nowSec: number) {
  if (!g || BigInt(g.total) === 0n || !(mezoUsd > 0)) return null;
  const stakedUsd = (tvlUsd * Number(g.staked)) / Number(g.total);
  const aprPct = gaugeAprPct(BigInt(g.rewardRate), stakedUsd, BigInt(g.periodFinish), nowSec, mezoUsd);
  if (!(aprPct > 0)) return null;
  return { aprPct, stakedUsd, mezoPerDay: Number(formatUnits(BigInt(g.rewardRate), 18)) * 86_400, endsAt: new Date(Number(g.periodFinish) * 1000) };
}

const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const dayLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

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

/** A pool's live MEZO gauge, as strings so the cached value stays plain data. `staked` / `total` give the staked share:
 *  gauge.totalSupply / pool.totalSupply on basic pools, pool.stakedLiquidity / pool.liquidity on concentrated ones. */
export type GaugeRead = { rewardRate: string; periodFinish: string; staked: string; total: string };

/** One pool's gauge, or null when it has none, is not alive or any read fails: one pool's failure never fails the rest. */
export async function readGauge(pool: Address, cl: boolean): Promise<GaugeRead | null> {
  try {
    const gauge = await mezoClient.readContract({ address: MAINNET.poolsVoter, abi: poolsVoterAbi, functionName: "gauges", args: [pool] });
    if (gauge === zeroAddress) return null;
    const [alive, rewardRate, periodFinish, [staked, total]] = await Promise.all([
      mezoClient.readContract({ address: MAINNET.poolsVoter, abi: poolsVoterAbi, functionName: "isAlive", args: [gauge] }),
      mezoClient.readContract({ address: gauge, abi: vaultGaugeAbi, functionName: "rewardRate" }),
      mezoClient.readContract({ address: gauge, abi: vaultGaugeAbi, functionName: "periodFinish" }),
      cl
        ? Promise.all([mezoClient.readContract({ address: pool, abi: clPoolAbi, functionName: "stakedLiquidity" }), mezoClient.readContract({ address: pool, abi: clPoolAbi, functionName: "liquidity" })])
        : Promise.all([mezoClient.readContract({ address: gauge, abi: vaultGaugeAbi, functionName: "totalSupply" }), mezoClient.readContract({ address: pool, abi: poolAbi, functionName: "totalSupply" })]),
    ]);
    return alive ? { rewardRate: rewardRate.toString(), periodFinish: periodFinish.toString(), staked: staked.toString(), total: total.toString() } : null;
  } catch (error) {
    console.error(`[sources] gauge of ${pool} failed:`, error);
    return null;
  }
}

/** MUSD per MEZO from the MEZO/MUSD-200 pool's slot0 (MEZO is token0, both 18 decimals); null if the read fails or the price looks wrong. */
async function readMezoPoolPrice(): Promise<number | null> {
  try {
    const address = MAINNET.pools.mezoMusdCl200;
    const [token0, slot0] = await Promise.all([
      mezoClient.readContract({ address, abi: poolAbi, functionName: "token0" }),
      mezoClient.readContract({ address, abi: clPoolAbi, functionName: "slot0" }),
    ]);
    const price = (Number(slot0[0]) / 2 ** 96) ** 2;
    return getAddress(token0) === getAddress(MAINNET.mezo) && price >= 0.0001 && price <= 1 ? price : null;
  } catch {
    return null;
  }
}

export type MezoChain = Awaited<ReturnType<typeof readMezo>>;

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

  const smusdGauge = { address: MAINNET.smusdGauge, abi: vaultGaugeAbi } as const;
  const [spDeposits, pools, gasPrice, mezoPoolPriceMusd, savingsGauge, dittoAssets] = await Promise.all([
    mezoClient.readContract({ address: MAINNET.stabilityPool, abi: stabilityPoolAbi, functionName: "getTotalMUSDDeposits" }),
    // Gauge reads run beside the reserve reads, so they add no sequential round trip.
    Promise.all(
      POOLS.map(async (p) => {
        const [tokens, gauge] = await Promise.all([readPool(p.address), readGauge(p.address, p.kind.includes("Concentrated"))]);
        return { ...p, tokens: tokens.map((t) => ({ ...t, reserve: t.reserve.toString() })), gauge };
      }),
    ),
    mezoClient.getGasPrice(),
    readMezoPoolPrice(),
    // The two official vaults beside sMUSD: a failed read leaves that venue out instead of failing every Mezo venue.
    Promise.all([
      mezoClient.readContract({ ...smusdGauge, functionName: "rewardRate" }),
      mezoClient.readContract({ ...smusdGauge, functionName: "periodFinish" }),
      mezoClient.readContract({ ...smusdGauge, functionName: "totalSupply" }),
    ]).then(([rewardRate, periodFinish, staked]) => ({ rewardRate: rewardRate.toString(), periodFinish: periodFinish.toString(), staked: staked.toString() }), () => null),
    mezoClient.readContract({ address: MAINNET.dittoMusdVault, abi: erc4626Abi, functionName: "totalAssets" }).then((a) => Number(formatUnits(a, 18)), () => null),
  ]);
  return { now, btcPrice, borrow, paramsLive, spDeposits: Number(formatUnits(spDeposits, 18)), pools, gasPriceWei: gasPrice.toString(), mezoPoolPriceMusd, savingsGauge, dittoAssets };
}

/** Builds the Mezo venues from the cached chain read and today's MEZO price. */
export function mezoVenues(chain: MezoChain, mezoPriceUsd: number, priceSource = "the Mezo MEZO/MUSD pool", nowSec = Date.now() / 1000): MezoData {
  const { now, btcPrice, borrow, paramsLive, spDeposits } = chain;
  const pools = chain.pools.map((p) => ({ ...p, tvl: poolTvlUsd(p.tokens.map((t) => ({ ...t, reserve: BigInt(t.reserve) })), { btcUsd: btcPrice, mezoUsd: mezoPriceUsd }) }));

  // MEZO is valued at the MEZO/MUSD pool's price; that pool is small, so selling a lot of MEZO there moves the price.
  const mezoPool = pools.find((p) => p.address === MAINNET.pools.mezoMusdCl200);
  const sellNote = mezoPool ? [`MEZO mainly trades in the MEZO/MUSD-200 pool, which holds about ${usd0(mezoPool.tvl)}; selling a lot of MEZO there lowers its price.`] : [];

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
      const em = gaugeEmissions(p.gauge, p.tvl, mezoPriceUsd, nowSec);
      return {
        id: `mezo-pool-${p.address.toLowerCase()}`,
        name: p.name,
        chain: "Mezo",
        // Gauge MEZO is liquid, so it is an emissions rate (diluted by the user's amount over the staked value); LP fees are not read.
        rates: { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl: em ? em.stakedUsd : p.tvl, ...(em && { emissionsApr: em.aprPct }) },
        tvlUsd: p.tvl,
        ends: em ? em.endsAt.toISOString() : null,
        action: em ? { label: "Stake in the Mezo app", url: "https://mezo.org/earn/pools" } : { label: "See APR in the Mezo app", url: "https://mezo.org/earn/pools" },
        source: { label: em ? "Mezo chain: gauge and pool reserves" : "Mezo chain — pool reserves", url: `https://explorer.mezo.org/address/${p.address}` },
        routes: [],
        ...(p.name.includes("BTC/") ? { pairToken: "BTC" as const } : p.name.includes("MEZO/") ? { pairToken: "MEZO" as const } : {}),
        tags: [
          "Mezo-native",
          p.kind,
          ...(p.name.includes("BTC") ? ["BTC price exposure"] : []),
          ...(p.name.includes("MEZO/") ? ["MEZO price exposure"] : []),
          ...(em ? ["Paid in MEZO"] : []),
          ...(em && em.stakedUsd < 10_000 ? ["Small pool: the rate drops fast as money comes in"] : []),
        ],
        notes: em
          ? [
              `Pays about ${Math.round(em.mezoPerDay).toLocaleString("en-US")} MEZO a day to staked LP until ${dayLabel(em.endsAt)}, valued at $${mezoPriceUsd.toFixed(5)} per MEZO from ${priceSource}.`,
              "LP trading fees are not included.",
              ...sellNote,
              ...(p.kind.includes("Concentrated") ? ["Only in-range staked liquidity earns; the rate is an estimate from the pool's staked share."] : []),
            ]
          : ["The Mezo app shows this pool's fee APR and emissions APR; Compass shows its size and links there."],
        status: "ok",
        updatedAt: now,
      };
    }),
  ];

  const gauged = savingsGaugeVenue(chain.savingsGauge, mezoPriceUsd, priceSource, nowSec, now, sellNote);
  if (gauged) venues.splice(1, 0, gauged);
  if (chain.dittoAssets !== null) venues.push(dittoVenue(chain.dittoAssets, now));

  return { venues, borrow, btcPriceUsd: btcPrice, gasPriceWei: chain.gasPriceWei, paramsLive };
}

/** sMUSD staked in Mezo's MUSD Savings gauge: MEZO emissions instead of the vault's fee yield (Mezo docs, MUSD Savings Vault).
 *  1 sMUSD is counted as 1 MUSD, as on the My MUSD page. Null when the gauge was not read, has ended or holds nothing. */
export function savingsGaugeVenue(g: { rewardRate: string; periodFinish: string; staked: string } | null, mezoPriceUsd: number, priceSource: string, nowSec: number, now: string, sellNote: string[] = []): Venue | null {
  if (!g || !(mezoPriceUsd > 0)) return null;
  const stakedUsd = Number(formatUnits(BigInt(g.staked), 18));
  const aprPct = gaugeAprPct(BigInt(g.rewardRate), stakedUsd, BigInt(g.periodFinish), nowSec, mezoPriceUsd);
  if (!(aprPct > 0)) return null;
  const endsAt = new Date(Number(g.periodFinish) * 1000);
  const mezoPerDay = Number(formatUnits(BigInt(g.rewardRate), 18)) * 86_400;
  return {
    id: "mezo-smusd-gauge",
    name: "MUSD Savings Vault, staked in the gauge",
    chain: "Mezo",
    rates: { liquidApr: 0, lockedApr: null, fixedCostUsd: 0, tvl: stakedUsd, emissionsApr: aprPct },
    tvlUsd: stakedUsd,
    ends: endsAt.toISOString(),
    action: { label: "Stake in the Mezo app", url: "https://mezo.org/earn/vaults" },
    source: { label: "Mezo chain: MUSD Savings gauge", url: `https://explorer.mezo.org/address/${MAINNET.smusdGauge}` },
    routes: [],
    tags: ["Mezo-native", "Paid in MEZO", "No vault fee yield while staked"],
    notes: [
      `Pays about ${Math.round(mezoPerDay).toLocaleString("en-US")} MEZO a day to staked sMUSD until ${dayLabel(endsAt)}, valued at $${mezoPriceUsd.toFixed(5)} per MEZO from ${priceSource}.`,
      "While staked, your share of the vault's fees goes to veBTC voters instead (Mezo docs). Unstaking brings the fee yield back.",
      ...sellNote,
    ],
    status: "ok",
    updatedAt: now,
  };
}

/** Ditto MUSD Vault, listed in the Mezo app. Its yield is earned on Ethereum and Compass cannot read it on Mezo, so it lists size only. */
export function dittoVenue(assetsMusd: number, now: string): Venue {
  return {
    id: "mezo-ditto-musd",
    name: "Ditto MUSD Vault",
    chain: "Mezo",
    rates: { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl: assetsMusd },
    tvlUsd: assetsMusd,
    ends: null,
    action: { label: "See its rate in the Mezo app", url: "https://mezo.org/earn/vaults" },
    source: { label: "Mezo chain: vault assets", url: `https://explorer.mezo.org/address/${MAINNET.dittoMusdVault}` },
    routes: [],
    tags: ["Listed in the Mezo app", "Yield earned on Ethereum", "Withdrawals are batched"],
    notes: ["The vault moves MUSD to a USDC strategy on Ethereum, so its rate is not on the Mezo chain; the Mezo app shows an estimate. Withdrawals wait for a batch and carry MUSD/USDC price risk (Mezo docs)."],
    status: "ok",
    updatedAt: now,
  };
}
