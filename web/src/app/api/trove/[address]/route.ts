import { after } from "next/server";
import type { Address, PublicClient } from "viem";
import { mezoClient } from "@/lib/chain/clients";
import { allow, tooMany } from "@/lib/rateLimit";
import { loadSources } from "@/lib/sources";
import { countCall } from "@/lib/stats";
import { fetchTroveQueue } from "@/lib/sources/troveQueue";
import { troveAdvice } from "@/lib/safety";
import { previewTrove, publicTrove, readTrove, SAFE_ICR, sampleTrove, type TroveView } from "@/lib/trove";
import { toWallet } from "@/lib/vault";

export const maxDuration = 300; // reads loadSources, same cold fill as /api/yields
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
  nicr: "1250000000000000000",
};

const AMOUNT = /^\d+(\.\d{1,8})?$/;
const AMOUNT_ERROR = { addBtc: "Enter BTC as a plain number, up to 8 decimals.", repayMusd: "Enter MUSD as a plain number, up to 8 decimals." };

/** Mainnet trove for an address, or `sample` for the safest live trove (SortedTroves.getFirst()). */
export async function GET(req: Request, { params }: { params: Promise<{ address: string }> }) {
  if (!allow(req)) return tooMany(HEADERS);
  after(() => countCall("trove", req));
  const raw = (await params).address;
  const address = raw === "sample" ? raw : toWallet(raw);
  if (!address) return Response.json({ error: "That is not an EVM address (0x… with 40 hex characters)." }, { status: 400, headers: HEADERS });
  const about = { network: "Mezo mainnet", safeIcrPct: SAFE_ICR * 100, minIcrPct: 110 };
  const q = new URL(req.url).searchParams;
  const change: { addBtc?: number; repayMusd?: number } = {};
  for (const k of ["addBtc", "repayMusd"] as const) {
    const v = q.get(k);
    if (v === null) continue;
    if (!AMOUNT.test(v)) return Response.json({ error: AMOUNT_ERROR[k] }, { status: 400, headers: HEADERS });
    change[k] = Number(v);
  }
  const wantsPreview = change.addBtc !== undefined || change.repayMusd !== undefined;
  const withPreview = (t: TroveView, nicrs: bigint[] | null) => {
    if (!wantsPreview || !t.active) return {};
    try {
      return { preview: previewTrove(t, change, nicrs) };
    } catch (e) {
      return { bad: (e as Error).message };
    }
  };
  const reply = (t: TroveView, nicrs: bigint[] | null, market: { musdUsd: number; floorUsd: number; redemptionPct: number } | null) => {
    const { bad, ...extra } = withPreview(t, nicrs) as { bad?: string; preview?: unknown };
    if (bad) return Response.json({ error: bad }, { status: 400, headers: HEADERS });
    return Response.json({ ...publicTrove(t), advice: troveAdvice(t, undefined, undefined, market), market, ...extra, ...about }, { headers: HEADERS });
  };
  if (process.env.COMPASS_FIXTURES === "1") return reply(FIXTURE, null, { musdUsd: 0.9951, floorUsd: 0.9925, redemptionPct: 0.75 });

  const client = mezoClient as PublicClient;
  try {
    const [sources, queue, who] = await Promise.all([
      loadSources(),
      fetchTroveQueue().catch(() => null), // the position is optional; the rest still answers
      address === "sample" ? sampleTrove(client) : Promise.resolve(address as Address),
    ]);
    const nicrs = queue ? queue.map(BigInt) : null;
    const trove = await readTrove(client, who, sources.borrow.feePct, nicrs);
    const p = sources.peg;
    return reply(trove, nicrs, p ? { musdUsd: p.priceUsd, floorUsd: p.floorUsd, redemptionPct: p.redemptionPct } : null);
  } catch {
    return Response.json({ error: "Mezo mainnet is unavailable right now — try again in a minute." }, { status: 503, headers: HEADERS });
  }
}
