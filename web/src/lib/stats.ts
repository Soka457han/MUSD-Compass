import { cacheLife } from "next/cache";
import { decodePaymentResponseHeader } from "@x402/core/http";
import { isBot } from "@/lib/rateLimit";
import { pipeline, redis, storeConfigured } from "@/lib/store";
import { X402_NETWORKS } from "@/lib/x402";

// Honest counters: our own traffic never counts as outside use, and no address or chat id is stored (HyperLogLogs and totals only).
// Every function swallows errors so counting can never break or delay a response; routes call them inside after().
export const ROUTES = ["yields", "premium", "trove", "embed"] as const;
export type Route = (typeof ROUTES)[number];
const NETS = ["testnet", "mainnet"] as const;
type Net = (typeof NETS)[number];

const OWN_WALLETS = ["0xfe21B2782B35BE770DD4a7b05f81cE43790D676C", "0xC20F87B85A58a0Bc1E0eE851D0bBAaDFFf9e9C4C"].map((a) => a.toLowerCase());
const TTL = 3_456_000; // 40 days of daily keys

const day = (offset = 0) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

export async function countCall(route: Route, req: Request): Promise<void> {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("warm") === "1") return;
    const today = day();
    const daily = `stats:calls:${route}:${today}`;
    const cmds: (string | number)[][] = [
      ["INCR", `stats:calls:${route}`],
      ["INCR", daily],
      ["EXPIRE", daily, TTL],
      ["SET", "stats:since", today, "NX"],
    ];
    const user = req.headers.get("x-compass-user");
    if (user && isBot(req) && /^[0-9a-f]{16}$/.test(user)) cmds.push(["PFADD", "stats:botusers", user]);
    await pipeline(cmds);
  } catch {}
}

const ours = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "musd-compass.vercel.app" || /^musd-compass-[a-z0-9-]+\.vercel\.app$/.test(host);

/** Counts only real iframe loads (sec-fetch-dest), and only named hosts: not IP literals or single-label hosts. */
export async function countEmbedHost(referer: string | null, dest: string | null): Promise<void> {
  try {
    if (!referer || dest !== "iframe") return;
    const host = new URL(referer).hostname;
    if (host && host.includes(".") && !host.includes(":") && !/^\d+\.\d+\.\d+\.\d+$/.test(host) && !ours(host)) await redis("ZINCRBY", "stats:embed:hosts", 1, host);
  } catch {}
}

export async function countPayment(header: string | null): Promise<void> {
  try {
    if (!header) return;
    const s = decodePaymentResponseHeader(header);
    const net = NETS.find((n) => X402_NETWORKS[n] === s.network);
    if (!s.success || !net) return;
    const payer = s.payer?.toLowerCase();
    if (payer && OWN_WALLETS.includes(payer)) {
      await redis("INCR", `stats:x402:own:${net}`);
      return;
    }
    const cmds: (string | number)[][] = [["INCR", `stats:x402:payments:${net}`]];
    if (payer) cmds.push(["PFADD", `stats:x402:payers:${net}`, payer]);
    await pipeline(cmds);
  } catch {}
}

export type Stats = {
  since: string | null;
  calls: Record<Route, { total: number; last7: number }>;
  botUsers: number;
  x402: Record<Net, { payments: number; payers: number; own: number }>;
  embedHosts: { host: string; count: number }[];
};

const n = (v: unknown) => Number(v) || 0;

/** Cached 60 s so a busy /stats page cannot hammer Redis. */
export async function readStats(): Promise<Stats | null> {
  "use cache";
  cacheLife({ revalidate: 60, expire: 300 });
  return readStatsNow();
}

export async function readStatsNow(): Promise<Stats | null> {
  if (!storeConfigured()) return null;
  const days = Array.from({ length: 7 }, (_, i) => day(i));
  const cmds: (string | number)[][] = [["GET", "stats:since"], ["PFCOUNT", "stats:botusers"], ["ZREVRANGE", "stats:embed:hosts", 0, 19, "WITHSCORES"]];
  for (const r of ROUTES) cmds.push(["GET", `stats:calls:${r}`], ...days.map((d) => ["GET", `stats:calls:${r}:${d}`]));
  for (const k of NETS) cmds.push(["GET", `stats:x402:payments:${k}`], ["PFCOUNT", `stats:x402:payers:${k}`], ["GET", `stats:x402:own:${k}`]);
  const out = await pipeline(cmds);
  if (!out) return null;
  let i = 3;
  const calls = {} as Stats["calls"];
  for (const r of ROUTES) {
    const total = n(out[i++]);
    let last7 = 0;
    for (let d = 0; d < 7; d++) last7 += n(out[i++]);
    calls[r] = { total, last7 };
  }
  const x402 = {} as Stats["x402"];
  for (const k of NETS) x402[k] = { payments: n(out[i++]), payers: n(out[i++]), own: n(out[i++]) };
  const flat = Array.isArray(out[2]) ? (out[2] as unknown[]) : [];
  const embedHosts = [];
  for (let j = 0; j + 1 < flat.length; j += 2) embedHosts.push({ host: String(flat[j]), count: n(flat[j + 1]) });
  return { since: typeof out[0] === "string" ? out[0] : null, calls, botUsers: n(out[1]), x402, embedHosts };
}
