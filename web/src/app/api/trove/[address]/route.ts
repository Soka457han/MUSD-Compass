import type { Address, PublicClient } from "viem";
import { mezoClient } from "@/lib/chain/clients";
import { allow } from "@/lib/rateLimit";
import { loadSources } from "@/lib/sources";
import { fetchTroveQueue } from "@/lib/sources/troveQueue";
import { readTrove, SAFE_ICR, sampleTrove, type TroveView } from "@/lib/trove";
import { isWallet } from "@/lib/vault";

export const maxDuration = 60;
const HEADERS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

const FIXTURE: TroveView = {
  address: "0x593c000000000000000000000000000000005bb5",
  active: true,
  collateralBtc: 1.25,
  collateralUsd: 100_597.5,
  debt: 30_210.4,
  icrPct: 333,
  ratePct: 1,
  ahead: 812,
  troves: 1_204,
  recoveryMode: false,
  safeExtra: 20_068.3, // (100,597.5 ÷ 2 − 30,210.4) ÷ 1.001
  btcUsd: 80_478,
};

/** Mainnet trove for an address, or `sample` for the safest live trove (SortedTroves.getFirst()). */
export async function GET(req: Request, { params }: { params: Promise<{ address: string }> }) {
  if (!allow(req)) return Response.json({ error: "Too many requests — try again in a minute." }, { status: 429, headers: HEADERS });
  const { address } = await params;
  if (address !== "sample" && !isWallet(address)) return Response.json({ error: "That is not an EVM address (0x… with 40 hex characters)." }, { status: 400, headers: HEADERS });
  const about = { network: "Mezo mainnet", safeIcrPct: SAFE_ICR * 100, minIcrPct: 110 };
  if (process.env.COMPASS_FIXTURES === "1") return Response.json({ ...FIXTURE, ...about }, { headers: HEADERS });

  const client = mezoClient as PublicClient;
  try {
    const [sources, queue, who] = await Promise.all([
      loadSources(),
      fetchTroveQueue().catch(() => null), // the position is optional; the rest still answers
      address === "sample" ? sampleTrove(client) : Promise.resolve(address as Address),
    ]);
    const trove = await readTrove(client, who, sources.borrow.feePct, queue ? queue.map(BigInt) : null);
    return Response.json({ ...trove, ...about }, { headers: HEADERS });
  } catch {
    return Response.json({ error: "Mezo mainnet is unavailable right now — try again in a minute." }, { status: 503, headers: HEADERS });
  }
}
