// Deterministic sources for local runs and e2e (COMPASS_FIXTURES=1): live samples recorded 24 Oct 2026.
import listings from "../../../tests/fixtures/merkl-opportunities-2026-10-24.json";
import smusdSample from "../../../tests/fixtures/smusd-yield-events-2026-10-24.json";
import type { Venue } from "@/lib/venue";
import type { Sources } from "@/lib/yields";
import { parseMerkl, type MerklListing } from "./merkl";
import { realisedApr } from "./smusd";

const at = "2026-10-24T15:40:00.000Z";
const base = { routes: [], ends: null, status: "ok" as const, updatedAt: at };

export function fixtureSources(): Sources {
  const apr = realisedApr(smusdSample.events, smusdSample.totalSupply, smusdSample.headTimestamp).aprPct;
  const pool = (id: string, name: string, kind: string, tvl: number): Venue => ({
    ...base,
    id,
    name,
    chain: "Mezo",
    rates: { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl },
    tvlUsd: tvl,
    action: { label: "See APR in the Mezo app", url: "https://mezo.org/earn/pools" },
    source: { label: "Mezo chain — pool balances", url: "https://explorer.mezo.org" },
    tags: ["Mezo-native", kind],
    notes: ["The Mezo app shows this pool's fee APR and emissions APR; Compass shows its size and links there."],
  });
  const venues: Venue[] = [
    {
      ...base,
      id: "mezo-smusd",
      name: "MUSD Savings Vault (sMUSD)",
      chain: "Mezo",
      rates: { liquidApr: apr, lockedApr: 0, fixedCostUsd: 0, tvl: null },
      tvlUsd: 7_382_555,
      action: { label: "Deposit (testnet)", url: "/vault" },
      source: { label: "Mezo chain — yield events", url: "https://explorer.mezo.org" },
      tags: ["Mezo-native", "No lock, no withdrawal fee", "Variable yield"],
      notes: [
        "Realised APR: yield paid in the last 14 days ÷ supply, annualised.",
        "Staking sMUSD in the Mezo gauge swaps this fee yield for MEZO emissions — see the Mezo app. Never both.",
      ],
    },
    {
      ...base,
      id: "mezo-stability-pool",
      name: "Stability Pool",
      chain: "Mezo",
      rates: { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl: 14_172_052 },
      tvlUsd: 14_172_052,
      action: { label: "About the Stability Pool", url: "https://mezo.org/docs/users/musd/" },
      source: { label: "Mezo chain", url: "https://explorer.mezo.org" },
      tags: ["No direct incentives", "Lumpy: earns only on liquidations"],
      notes: ["Protocol-seeded. Earns discounted BTC only when troves are liquidated, so it has no steady APR."],
    },
    pool("mezo-pool-musdc-musd-10", "Mezo pool mUSDC/MUSD-10", "Concentrated stable", 5_342_377),
    pool("mezo-pool-btc-musd", "Mezo pool BTC/MUSD", "Basic volatile", 77_021),
    pool("mezo-pool-btc-musd-200", "Mezo pool BTC/MUSD-200", "Concentrated volatile", 45_834),
    pool("mezo-pool-musd-musdt", "Mezo pool MUSD/mUSDT", "Basic stable", 13_164),
    pool("mezo-pool-musdc-musd", "Mezo pool mUSDC/MUSD", "Basic stable", 11_651),
    pool("mezo-pool-mezo-musd-200", "Mezo pool MEZO/MUSD-200", "Concentrated volatile", 5_795),
    ...parseMerkl(listings as MerklListing[], new Date(at)),
    {
      ...base,
      id: "ethereum-morpho-alpha-musd-core",
      name: "Morpho Alpha MUSD Core",
      chain: "Ethereum",
      rates: { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl: 18.06 },
      tvlUsd: 18.06,
      action: { label: "Open on Morpho", url: "https://app.morpho.org" },
      source: { label: "Ethereum chain", url: "https://etherscan.io" },
      tags: ["Ethereum — bridge needed", "Inactive"],
      notes: ["Only $18 deposited — effectively inactive."],
    },
  ];
  return {
    venues,
    benchmarkId: "mezo-smusd",
    borrow: { feePct: 0.1, gasCompensation: 200, minNetDebt: 1800, ratePct: 1 },
    paramsLive: true,
    ethRoundTrip: { usd: 1.28, basis: "≈1,150,000 Ethereum gas + 550,000 Mezo gas at live prices (bridge relay priced as gas; est.)" },
    mezoPriceUsd: 0.00297,
  };
}
