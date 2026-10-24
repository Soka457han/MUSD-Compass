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
  const last = await fetchSmusdTestnetLastDistribution().catch(() => null);
  const state = await readVault(mezoTestnetClient as PublicClient, address, last);
  return Response.json({ ...state, network: "Mezo testnet" }, { headers: HEADERS });
}
