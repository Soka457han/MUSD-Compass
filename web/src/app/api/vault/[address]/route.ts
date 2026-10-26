import { after } from "next/server";
import type { PublicClient } from "viem";
import { mezoTestnetClient } from "@/lib/chain/clients";
import { allow } from "@/lib/rateLimit";
import { fetchSmusdTestnetLastDistribution } from "@/lib/sources/smusd";
import { isWallet, readVault } from "@/lib/vault";

export const maxDuration = 60;
const HEADERS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

export async function GET(req: Request, { params }: { params: Promise<{ address: string }> }) {
  if (!allow(req)) return Response.json({ error: "Too many requests — try again in a minute." }, { status: 429, headers: HEADERS });
  const { address } = await params;
  if (!isWallet(address)) return Response.json({ error: "That is not an EVM address (0x… with 40 hex characters)." }, { status: 400, headers: HEADERS });
  if (process.env.COMPASS_FIXTURES === "1") {
    return Response.json({ address, musd: "157.31", allowance: "0", smusd: "0", pendingYield: "0", lastDistribution: 1792675011, network: "Mezo testnet" }, { headers: HEADERS });
  }
  // The last-distribution date needs a 14-day log scan; on a cold cache that takes many seconds (the bot gave up
  // waiting). Answer with the balances now and let the scan finish after the response, so the next ask has it.
  const scan = fetchSmusdTestnetLastDistribution().catch(() => null);
  after(() => scan);
  const last = await Promise.race([scan, new Promise<"slow">((r) => setTimeout(() => r("slow"), 2500))]);
  try {
    const state = await readVault(mezoTestnetClient as PublicClient, address, last === "slow" ? null : last);
    return Response.json({ ...state, lastDistributionPending: last === "slow", network: "Mezo testnet" }, { headers: HEADERS });
  } catch (e) {
    console.error("[vault] testnet read failed:", e);
    return Response.json({ error: "Mezo testnet did not answer — try again in a minute." }, { status: 503, headers: HEADERS });
  }
}
