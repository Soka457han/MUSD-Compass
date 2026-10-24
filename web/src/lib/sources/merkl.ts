import { cacheLife } from "next/cache";
import { isMezoMusd } from "@/lib/carry/identity";
import { MAINNET } from "@/lib/chain/addresses";
import type { Venue } from "@/lib/venue";

// Merkl v4 opportunity (only the fields we read). Live sample: tests/fixtures/merkl-opportunities-2026-10-24.json
export type MerklListing = {
  chainId: number;
  type: string;
  identifier: string;
  name: string;
  tvl: number;
  apr: number;
  nativeApr?: number;
  dailyRewards: number;
  latestCampaignEnd: string;
  depositUrl?: string;
  tokens: { address: string; symbol: string; chainId: number }[];
  protocol: { id: string; name: string } | null;
  rewardsRecord: { breakdowns: { token: { address: string; symbol: string; chainId: number } }[] };
};

const API = "https://api.merkl.xyz/v4";
const VE_MEZO = MAINNET.merklVeMezo.toLowerCase();
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const paysVeMezo = (l: MerklListing) =>
  l.rewardsRecord.breakdowns.some((b) => b.token.chainId === 31612 && same(b.token.address, VE_MEZO));
const holdsMusd = (l: MerklListing) => l.tokens.some((t) => isMezoMusd(t.chainId, t.address));

/** Mezo-paid MUSD venues from raw Merkl listings. Nested listings (e.g. a Curve LP staked in a gauge,
 *  Stake DAO or Convex) share the outer listing's reward stream, so they become route chips, never rows. */
export function parseMerkl(listings: MerklListing[], now = new Date()): Venue[] {
  const ours = listings.filter(paysVeMezo);
  const outer = ours.filter(holdsMusd);
  return outer.map((l) => {
    const nested = ours.filter((n) => n !== l && !holdsMusd(n) && n.tokens.some((t) => same(t.address, l.identifier)));
    const isUniV4 = l.type === "UNISWAP_V4";
    const notes = [
      "Rewards are veMEZO: claimed on Mezo, locked 12 weeks, valued at the MEZO spot price.",
      ...(l.nativeApr === undefined ? ["Trading fees not reported by Merkl — counted as 0."] : []),
    ];
    return {
      id: `merkl-${l.chainId}-${l.protocol?.id ?? l.type}-${l.identifier}`.toLowerCase(),
      name: isUniV4 ? "Uniswap V4 USDC/MUSD" : l.protocol?.name === "Curve" ? "Curve MUSD/USDC/USDT" : l.name,
      chain: "Ethereum",
      rates: { liquidApr: l.nativeApr ?? null, lockedApr: l.apr, fixedCostUsd: 0, tvl: l.tvl },
      tvlUsd: l.tvl,
      ends: new Date(Number(l.latestCampaignEnd) * 1000).toISOString(),
      action: { label: "Provide liquidity", url: l.depositUrl ?? "https://app.merkl.xyz" },
      source: { label: "Merkl", url: "https://app.merkl.xyz" },
      routes: nested.map((n) => ({ name: n.protocol?.name ?? n.name, url: n.depositUrl ?? "https://app.merkl.xyz" })),
      tags: ["Ethereum — bridge needed", "veMEZO locked 12 weeks", "7-day campaign", ...(isUniV4 ? ["Two tokens", "Range position"] : [])],
      notes,
      status: "ok",
      updatedAt: now.toISOString(),
    } satisfies Venue;
  });
}

export type MerklData = { venues: Venue[]; mezoPriceUsd: number | null; ethPriceUsd: number | null; raw: MerklListing[] };

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return (await r.json()) as T;
}

export async function fetchMerkl(): Promise<MerklData> {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 3600 });
  const [listings, mezo, weth] = await Promise.all([
    getJson<MerklListing[]>(`${API}/opportunities?search=MUSD&status=LIVE&items=50`),
    getJson<{ price: number }[]>(`${API}/tokens?chainId=31612&symbol=MEZO`).catch(() => []),
    getJson<{ price: number }[]>(`${API}/tokens?chainId=1&symbol=WETH`).catch(() => []),
  ]);
  return {
    venues: parseMerkl(listings),
    mezoPriceUsd: mezo[0]?.price ?? null,
    ethPriceUsd: weth[0]?.price ?? null,
    raw: listings.filter(paysVeMezo),
  };
}
