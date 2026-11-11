import { after } from "next/server";
import type { PublicClient } from "viem";
import { mezoClient, mezoTestnetClient } from "@/lib/chain/clients";
import { readGaugePosition } from "@/lib/gaugeActions";
import { allow } from "@/lib/rateLimit";
import { fetchSmusdMainnet, fetchSmusdTestnetLastDistribution } from "@/lib/sources/smusd";
import { isWallet, readVault } from "@/lib/vault";

export const maxDuration = 60;
const HEADERS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

export async function GET(req: Request, { params }: { params: Promise<{ address: string }> }) {
  if (!allow(req)) return Response.json({ error: "Too many requests — try again in a minute." }, { status: 429, headers: HEADERS });
  const { address } = await params;
  if (!isWallet(address)) return Response.json({ error: "That is not an EVM address (0x… with 40 hex characters)." }, { status: 400, headers: HEADERS });
  // ?network=mainnet reads the mainnet vault; anything else but testnet (the default) is refused, so a typo never answers with the wrong network.
  const asked = new URL(req.url).searchParams.get("network") ?? "testnet";
  if (asked !== "testnet" && asked !== "mainnet") return Response.json({ error: "network must be testnet or mainnet." }, { status: 400, headers: HEADERS });
  const mainnet = asked === "mainnet";
  const label = mainnet ? "Mezo mainnet" : "Mezo testnet";
  if (process.env.COMPASS_FIXTURES === "1") {
    const gauge = mainnet ? { staked: "0", earnedMezo: "0" } : {};
    return Response.json({ address, musd: "157.31", allowance: "0", smusd: "0", pendingYield: "0", lastDistribution: 1792675011, ...gauge, network: label }, { headers: HEADERS });
  }
  // The last-distribution date needs a 14-day log scan; on a cold cache that takes many seconds (the bot gave up
  // waiting). Answer with the balances now and let the scan finish after the response, so the next ask has it.
  const scan = (mainnet ? fetchSmusdMainnet().then((d) => d.lastDistribution) : fetchSmusdTestnetLastDistribution()).catch(() => null);
  after(() => scan);
  const last = await Promise.race([scan, new Promise<"slow">((r) => setTimeout(() => r("slow"), 2500))]);
  try {
    const client = (mainnet ? mezoClient : mezoTestnetClient) as PublicClient;
    // The gauge is mainnet only. Its read failing must not hide the vault balances: both fields go null instead.
    const gaugeRead = mainnet
      ? readGaugePosition(client, address).catch((e) => {
          console.error("[vault] mainnet gauge read failed:", e);
          return { staked: null, earnedMezo: null };
        })
      : undefined;
    const [state, gauge] = await Promise.all([readVault(client, address, last === "slow" ? null : last, asked), gaugeRead]);
    return Response.json({ ...state, ...gauge, lastDistributionPending: last === "slow", network: label }, { headers: HEADERS });
  } catch (e) {
    console.error(`[vault] ${asked} read failed:`, e);
    return Response.json({ error: `${label} did not answer. Try again in a minute.` }, { status: 503, headers: HEADERS });
  }
}
