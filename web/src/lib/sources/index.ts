import { cacheLife } from "next/cache";
import { MAINNET } from "@/lib/chain/addresses";
import { unavailable, type Venue } from "@/lib/venue";
import type { Sources } from "@/lib/yields";
import { fetchEthereum, roundTripCostUsd } from "./ethereum";
import { fetchMerkl } from "./merkl";
import { FALLBACK_BORROW_PARAMS, fetchMezoPoolAprs, mezoVenues, readMezo } from "./mezo";
import { fetchSmusdMainnet } from "./smusd";
import { fixtureSources } from "./fixture";

const settle = <T,>(p: Promise<T>, name: string) =>
  p.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      console.error(`[sources] ${name} failed:`, error); // visible in Vercel function logs
      return { ok: false as const, error };
    },
  );

/** Every source, cached as one value for the page, the API, the bot and the widget alike: built ahead of time
 *  with the home page, served at once, refreshed in the background after 5 minutes. Before, each API call
 *  assembled it again and, right after a deploy, waited on every cold source (the bot gave up). */
export async function loadSources(): Promise<Sources> {
  "use cache";
  cacheLife({ revalidate: 300, expire: 86_400 });
  return readSources();
}

/** Loads every source; a failed source becomes an "unavailable" venue instead of an error page. */
async function readSources(): Promise<Sources> {
  if (process.env.COMPASS_FIXTURES === "1") return fixtureSources();
  // All four in parallel: the Mezo chain read no longer waits for Merkl's MEZO price.
  const [merkl, smusd, eth, chain, poolAprs] = await Promise.all([settle(fetchMerkl(), "merkl"), settle(fetchSmusdMainnet(), "smusd"), settle(fetchEthereum(), "ethereum"), settle(readMezo(), "mezo"), settle(fetchMezoPoolAprs(), "mezo-pools-api")]);
  const mezoPrice = merkl.ok ? merkl.value.mezoPriceUsd : null;
  const mezo = chain.ok ? { ok: true as const, value: mezoVenues(chain.value, mezoPrice ?? 0, poolAprs.ok ? poolAprs.value : null) } : chain;

  const venues: Venue[] = [
    smusd.ok
      ? smusd.value.venue
      : unavailable("mezo-smusd", "MUSD Savings Vault (sMUSD)", "Mezo", { label: "Mezo chain", url: `https://explorer.mezo.org/address/${MAINNET.smusd}` }, { label: "Deposit (testnet)", url: "/vault" }),
    ...(mezo.ok ? mezo.value.venues : [unavailable("mezo-pools", "Mezo pools & Stability Pool", "Mezo", { label: "Mezo chain", url: "https://explorer.mezo.org" }, { label: "Open the Mezo app", url: "https://mezo.org/earn/pools" })]),
    ...(merkl.ok ? merkl.value.venues : [unavailable("merkl", "Mezo-paid Ethereum pools", "Ethereum", { label: "Merkl", url: "https://app.merkl.xyz" }, { label: "Open Merkl", url: "https://app.merkl.xyz" })]),
    ...(eth.ok ? [eth.value.morpho] : []),
  ];

  const ethRoundTrip =
    eth.ok && mezo.ok && merkl.ok && merkl.value.ethPriceUsd
      ? roundTripCostUsd({
          ethGasPriceWei: BigInt(eth.value.gasPriceWei),
          ethPriceUsd: merkl.value.ethPriceUsd,
          mezoGasPriceWei: BigInt(mezo.value.gasPriceWei),
          btcPriceUsd: mezo.value.btcPriceUsd,
        })
      : null;

  return {
    venues,
    benchmarkId: "mezo-smusd",
    borrow: mezo.ok ? mezo.value.borrow : FALLBACK_BORROW_PARAMS,
    paramsLive: mezo.ok && mezo.value.paramsLive,
    ethRoundTrip,
    mezoPriceUsd: mezoPrice,
  };
}
