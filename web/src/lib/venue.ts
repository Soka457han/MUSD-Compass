import type { VenueRates } from "./carry/carry";

export type Chain = "Mezo" | "Ethereum";

/** One place to earn with MUSD, as every source adapter returns it. */
export type Venue = {
  id: string;
  name: string;
  chain: Chain;
  rates: VenueRates;
  tvlUsd: number | null;
  ends: string | null; // ISO date when the current reward campaign ends
  action: { label: string; url: string };
  source: { label: string; url: string };
  routes: { name: string; url: string }[]; // "also via" chips (never summed)
  tags: string[]; // plain-language risk tags
  pairToken?: "BTC" | "MEZO"; // a deposit also needs this token, so the venue is listed apart from MUSD-only spots
  notes: string[];
  incentiveUsdPerDay?: number; // what the reward campaign pays out per day (Merkl venues only)
  mezoSellDepthMusd?: number; // MEZO-paid venues: MUSD the Mezo MEZO/MUSD pool holds to pay out MEZO sellers
  status: "ok" | "unavailable";
  updatedAt: string;
};

export function unavailable(id: string, name: string, chain: Chain, source: Venue["source"], action: Venue["action"]): Venue {
  return {
    id, name, chain, source, action,
    rates: { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl: null },
    tvlUsd: null, ends: null, routes: [], tags: [], notes: ["Source unavailable right now — showing nothing rather than a stale guess."],
    status: "unavailable", updatedAt: new Date().toISOString(),
  };
}
