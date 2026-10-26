import { cacheLife } from "next/cache";
import { formatUnits } from "viem";
import { erc4626Abi } from "@/lib/chain/abis";
import { ETHEREUM } from "@/lib/chain/addresses";
import { ethereumClient } from "@/lib/chain/clients";
import type { Venue } from "@/lib/venue";

/** Gas units for one Ethereum round trip (stated assumptions, est.):
 *  bridge out = Mezo send + Wormhole NTT relay that executes on Ethereum; LP approve + add + remove;
 *  bridge back = Ethereum send + relay that executes on Mezo. The NTT relay fee is roughly the destination gas,
 *  so it is priced as gas; Portal shows the exact quote before you bridge. */
export const ROUND_TRIP_GAS = { ethereum: 350_000 + 50_000 + 300_000 + 250_000 + 200_000, mezo: 200_000 + 350_000 };

export function roundTripCostUsd(p: { ethGasPriceWei: bigint; ethPriceUsd: number; mezoGasPriceWei: bigint; btcPriceUsd: number }) {
  const eth = Number(formatUnits(BigInt(ROUND_TRIP_GAS.ethereum) * p.ethGasPriceWei, 18)) * p.ethPriceUsd;
  const mezo = Number(formatUnits(BigInt(ROUND_TRIP_GAS.mezo) * p.mezoGasPriceWei, 18)) * p.btcPriceUsd;
  return { usd: eth + mezo, basis: `≈${ROUND_TRIP_GAS.ethereum.toLocaleString("en-US")} Ethereum gas + ${ROUND_TRIP_GAS.mezo.toLocaleString("en-US")} Mezo gas at live prices (bridge relay priced as gas; est.)` };
}

export const INACTIVE_TVL_USD = 1_000;

export async function fetchEthereum(): Promise<{ gasPriceWei: string; morpho: Venue }> {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 86_400 }); // after 5 min a visit gets the cached copy at once and refreshes it in the background; only a full day without visits makes one wait
  const [gasPrice, assets] = await Promise.all([
    ethereumClient.getGasPrice(),
    ethereumClient.readContract({ address: ETHEREUM.morphoAlphaMusdCore, abi: erc4626Abi, functionName: "totalAssets" }),
  ]);
  const tvl = Number(formatUnits(assets, 18)); // asset = MUSD (checked 24 Oct)
  return {
    gasPriceWei: gasPrice.toString(),
    morpho: {
      id: "ethereum-morpho-alpha-musd-core",
      name: "Morpho Alpha MUSD Core",
      chain: "Ethereum",
      rates: { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl },
      tvlUsd: tvl,
      ends: null,
      action: { label: "Open on Morpho", url: `https://app.morpho.org/ethereum/vault/${ETHEREUM.morphoAlphaMusdCore}` },
      source: { label: "Ethereum chain", url: `https://etherscan.io/address/${ETHEREUM.morphoAlphaMusdCore}` },
      routes: [],
      tags: ["Ethereum — bridge needed", ...(tvl < INACTIVE_TVL_USD ? ["Inactive"] : [])],
      notes: tvl < INACTIVE_TVL_USD ? [`Only $${tvl.toFixed(0)} deposited — effectively inactive.`] : [],
      status: "ok",
      updatedAt: new Date().toISOString(),
    },
  };
}
