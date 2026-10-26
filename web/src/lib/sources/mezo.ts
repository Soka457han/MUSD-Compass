import { cacheLife } from "next/cache";
import { formatUnits, getAddress, type Address } from "viem";
import type { BorrowParams } from "@/lib/carry/carry";
import { borrowerOperationsAbi, erc20Abi, interestRateManagerAbi, poolAbi, priceFeedAbi, stabilityPoolAbi, vaultGaugeAbi } from "@/lib/chain/abis";
import { MAINNET } from "@/lib/chain/addresses";
import { mezoClient } from "@/lib/chain/clients";
import { gaugeAprPct } from "@/lib/gauge";
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

// Gauges from the Mezo app (26 Oct); each is used only if its stakingToken() is the pool, so a wrong address is ignored.
const POOLS: { address: Address; name: string; kind: string; gauge: Address }[] = [
  { address: MAINNET.pools.musdcMusdCl10, name: "Mezo pool mUSDC/MUSD-10", kind: "Concentrated stable", gauge: "0x6d446E27505c71EE39D632488cE849fEF6aFFc57" as Address },
  { address: MAINNET.pools.btcMusd, name: "Mezo pool BTC/MUSD", kind: "Basic volatile", gauge: "0x8Be20a5fF57E381025aE5E3A121B697269569AaF" as Address },
  { address: MAINNET.pools.btcMusdCl200, name: "Mezo pool BTC/MUSD-200", kind: "Concentrated volatile", gauge: "0x21d7AcB0D128fA039064B6aCe8Db88c0aDe0209E" as Address },
  { address: MAINNET.pools.musdMusdt, name: "Mezo pool MUSD/mUSDT", kind: "Basic stable", gauge: "0x4887Fa1C88f8927932e5e1545b3b29A1a29656E7" as Address },
  { address: MAINNET.pools.musdcMusd, name: "Mezo pool mUSDC/MUSD", kind: "Basic stable", gauge: "0x2945401F5E015A122b482de0EA5Bf92C005C3C75" as Address },
  { address: MAINNET.pools.mezoMusdCl200, name: "Mezo pool MEZO/MUSD-200", kind: "Concentrated volatile", gauge: "0xa763cEE0cBE643e2381CE2B0C457b4451d59C40D" as Address },
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

/** A gauge's MEZO stream and how much LP is staked in it, as strings for the cache. Null if it is not this pool's gauge. */
async function readGauge(gauge: Address, pool: Address, concentrated: boolean) {
  try {
    const g = { address: gauge, abi: vaultGaugeAbi } as const;
    const reads = Promise.all([
      mezoClient.readContract({ ...g, functionName: "stakingToken" }),
      mezoClient.readContract({ ...g, functionName: "rewardRate" }),
      mezoClient.readContract({ ...g, functionName: "totalSupply" }),
      mezoClient.readContract({ ...g, functionName: "periodFinish" }),
      concentrated ? Promise.resolve(0n) : mezoClient.readContract({ address: pool, abi: erc20Abi, functionName: "totalSupply" }), // concentrated pools have no LP token
    ]);
    // A call that reverts is retried by the transport; never let that hold up the page build (Vercel stops a slow cached read).
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("gauge read timed out")), 4000));
    const [stakingToken, rewardRate, staked, periodFinish, poolSupply] = await Promise.race([reads, timeout]);
    if (stakingToken.toLowerCase() !== pool.toLowerCase()) return null;
    return { rewardRate: rewardRate.toString(), staked: staked.toString(), periodFinish: periodFinish.toString(), poolSupply: poolSupply.toString() };
  } catch {
    return null;
  }
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
    Promise.all(POOLS.map(async (p) => ({ ...p, tokens: (await readPool(p.address)).map((t) => ({ ...t, reserve: t.reserve.toString() })), gaugeRead: await readGauge(p.gauge, p.address, p.kind.startsWith("Concentrated")) }))),
    mezoClient.getGasPrice(),
  ]);
  return { now, btcPrice, borrow, paramsLive, spDeposits: Number(formatUnits(spDeposits, 18)), pools, gasPriceWei: gasPrice.toString() };
}

/** Builds the Mezo venues from the cached chain read and today's MEZO price. */
export function mezoVenues(chain: MezoChain, mezoPriceUsd: number): MezoData {
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
      const g = p.gaugeRead;
      // Staked value: a basic pool's share of LP in the gauge. Concentrated pools have no LP token, so all liquidity counts (a floor on the rate).
      const concentrated = p.kind.startsWith("Concentrated");
      const share = g && !concentrated && BigInt(g.poolSupply) > 0n ? Number((BigInt(g.staked) * 10_000n) / BigInt(g.poolSupply)) / 10_000 : 1;
      const stakedUsd = p.tvl * share;
      const mezoApr = g && mezoPriceUsd > 0 ? gaugeAprPct(BigInt(g.rewardRate), stakedUsd, BigInt(g.periodFinish), Date.parse(now) / 1000, mezoPriceUsd) : null;
      // Only stable pairs are a place for MUSD alone; a BTC or MEZO pair needs that token too, so it stays unranked.
      const ranked = mezoApr !== null && mezoApr > 0 && p.kind.includes("stable");
      const p2 = (n: number) => `${n.toFixed(2)}%`;
      const atLeast = concentrated ? "at least " : "";
      return {
        id: `mezo-pool-${p.address.toLowerCase()}`,
        name: p.name,
        chain: "Mezo",
        rates: ranked
          ? { liquidApr: 0, lockedApr: null, fixedCostUsd: 0, tvl: stakedUsd, emissionsApr: mezoApr }
          : { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl: p.tvl },
        tvlUsd: p.tvl,
        ends: null,
        action: { label: ranked ? "Add liquidity in the Mezo app" : "See APR in the Mezo app", url: "https://mezo.org/earn/pools" },
        source: { label: g ? "Mezo chain — pool reserves and gauge" : "Mezo chain — pool reserves", url: `https://explorer.mezo.org/address/${g ? p.gauge : p.address}` },
        routes: [],
        tags: [
          "Mezo-native",
          p.kind,
          ...(p.name.includes("BTC") ? ["BTC price exposure"] : []),
          ...(p.name.includes("MEZO/") ? ["MEZO price exposure"] : []),
          ...(ranked ? ["Paid in MEZO when staked (liquid, price moves)"] : []),
          ...(mezoApr !== null && mezoApr > 0 && !ranked ? [`Mezo chain: ${atLeast}${p2(mezoApr)} in MEZO staked`] : []),
        ],
        notes:
          mezoApr !== null
            ? [
                `The gauge pays ${atLeast}${p2(mezoApr)} a year in MEZO to staked LP (reward rate × a year × MEZO price ÷ staked value). Staking hands the pool's trading fees to voters, so fees are not added.`,
                ...(concentrated ? ["Concentrated pool: only in-range liquidity earns, so in-range LP gets more than this floor."] : []),
              ]
            : ["The Mezo app shows this pool's fee APR and emissions APR; Compass shows its size and links there."],
        status: "ok",
        updatedAt: now,
      };
    }),
  ];

  return { venues, borrow, btcPriceUsd: btcPrice, gasPriceWei: chain.gasPriceWei, paramsLive };
}
