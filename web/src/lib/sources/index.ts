import { MAINNET } from "@/lib/chain/addresses";
import { unavailable, type Venue } from "@/lib/venue";
import type { Sources } from "@/lib/yields";
import { fetchEthereum, roundTripCostUsd } from "./ethereum";
import { fetchMerkl } from "./merkl";
import { FALLBACK_BORROW_PARAMS, fetchMezo } from "./mezo";
import { fetchSmusdMainnet } from "./smusd";
import { fixtureSources } from "./fixture";

const settle = <T,>(p: Promise<T>) => p.then((value) => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error }));

/** Loads every source; a failed source becomes an "unavailable" venue instead of an error page. */
export async function loadSources(): Promise<Sources> {
  if (process.env.COMPASS_FIXTURES === "1") return fixtureSources();
  const [merkl, smusd, eth] = await Promise.all([settle(fetchMerkl()), settle(fetchSmusdMainnet()), settle(fetchEthereum())]);
  const mezoPrice = merkl.ok ? merkl.value.mezoPriceUsd : null;
  const mezo = await settle(fetchMezo(mezoPrice ?? 0));

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
