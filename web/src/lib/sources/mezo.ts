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

export async function fetchMezo(mezoPriceUsd: number): Promise<MezoData> {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 3600 });
  const now = new Date().toISOString();
  const btcPrice = Number(formatUnits(await mezoClient.readContract({ address: MAINNET.priceFeed, abi: priceFeedAbi, functionName: "lastGoodPrice" }), 18));

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

  const spDeposits = Number(formatUnits(await mezoClient.readContract({ address: MAINNET.stabilityPool, abi: stabilityPoolAbi, functionName: "getTotalMUSDDeposits" }), 18));

  const pools = await Promise.all(POOLS.map(async (p) => ({ ...p, tvl: poolTvlUsd(await readPool(p.address), { btcUsd: btcPrice, mezoUsd: mezoPriceUsd }) })));

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
    ...pools.map(
      (p): Venue => ({
        id: `mezo-pool-${p.address.toLowerCase()}`,
        name: p.name,
        chain: "Mezo",
        rates: { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl: p.tvl },
        tvlUsd: p.tvl,
        ends: null,
        action: { label: "See APR in the Mezo app", url: "https://mezo.org/earn/pools" },
        source: { label: "Mezo chain — pool reserves", url: `https://explorer.mezo.org/address/${p.address}` },
        routes: [],
        tags: ["Mezo-native", p.kind, ...(p.name.includes("BTC") ? ["BTC price exposure"] : []), ...(p.name.includes("MEZO/") ? ["MEZO price exposure"] : [])],
        notes: ["The Mezo app shows this pool's fee APR and emissions APR; Compass shows its size and links there."],
        status: "ok",
        updatedAt: now,
      }),
    ),
  ];

  return { venues, borrow, btcPriceUsd: btcPrice, gasPriceWei: (await mezoClient.getGasPrice()).toString(), paramsLive };
}
