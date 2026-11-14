// Deterministic sources for local runs and e2e (COMPASS_FIXTURES=1): live samples recorded 24 Oct 2026.
import listings from "../../../tests/fixtures/merkl-opportunities-2026-10-24.json";
import smusdSample from "../../../tests/fixtures/smusd-yield-events-2026-10-24.json";
import { MAINNET } from "@/lib/chain/addresses";
import type { Venue } from "@/lib/venue";
import type { Sources } from "@/lib/yields";
import { parseMerkl, type MerklListing } from "./merkl";
import { dittoVenue, savingsGaugeVenue } from "./mezo";
import { realisedApr } from "./smusd";

const at = "2026-10-24T15:40:00.000Z";
const base = { routes: [], ends: null, status: "ok" as const, updatedAt: at };

export function fixtureSources(): Sources {
  const apr = realisedApr(smusdSample.events, smusdSample.totalSupply, smusdSample.headTimestamp).aprPct;
  // `gauge` = recorded gauge values (8 Nov 2026, mUSDC/MUSD basic pool): 12.274 MEZO a day, 0.5066 of 5.7989 LP staked, valued at the fixture MEZO price.
  const pool = (id: string, name: string, kind: string, tvl: number, gauge?: { stakedUsd: number; emissionsApr: number }, pairToken?: "BTC" | "MEZO"): Venue => ({
    ...base,
    ...(pairToken && { pairToken }),
    id,
    name,
    chain: "Mezo",
    rates: { liquidApr: null, lockedApr: null, fixedCostUsd: 0, tvl: gauge ? gauge.stakedUsd : tvl, ...(gauge && { emissionsApr: gauge.emissionsApr }) },
    tvlUsd: tvl,
    ends: gauge ? "2026-11-12T00:00:00.000Z" : null,
    action: { label: gauge ? "Stake in the Mezo app" : "See APR in the Mezo app", url: "https://mezo.org/earn/pools" },
    source: { label: gauge ? "Mezo chain: gauge and pool reserves" : "Mezo chain — pool balances", url: "https://explorer.mezo.org" },
    tags: ["Mezo-native", kind, ...(gauge ? ["Small pool: the rate drops fast as money comes in"] : [])],
    notes: gauge
      ? ["Pays about 12 MEZO a day to staked LP until 12 Nov 2026, valued at $0.00297 per MEZO from Merkl.", "LP trading fees are not included."]
      : ["The Mezo app shows this pool's fee APR and emissions APR; Compass shows its size and links there."],
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
        "Realised APR: yield paid in the last 7 days ÷ supply, annualised. Over 14 days it is 4.01%.",
        "Staking sMUSD in the gauge swaps this fee yield for MEZO emissions (listed separately). Never both.",
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
    pool("mezo-pool-btc-musd", "Mezo pool BTC/MUSD", "Basic volatile", 77_021, undefined, "BTC"),
    pool("mezo-pool-btc-musd-200", "Mezo pool BTC/MUSD-200", "Concentrated volatile", 45_834, undefined, "BTC"),
    pool("mezo-pool-musd-musdt", "Mezo pool MUSD/mUSDT", "Basic stable", 13_164),
    pool("mezo-pool-musdc-musd", "Mezo pool mUSDC/MUSD", "Basic stable", 11_651, { stakedUsd: 1_018, emissionsApr: 1.31 }),
    // Recorded 9 Nov 2026 (block 13092373): 71,200.53 MEZO a day to 131,302.52 staked sMUSD until 12 Nov, valued here at the fixture MEZO price.
    savingsGaugeVenue({ rewardRate: "824080208333333333", periodFinish: "1794441600", staked: "131302520000000000000000" }, 0.00297, "Merkl", Date.parse(at) / 1000, at, [], 824)!, // 824 MUSD: the MEZO pool's MUSD side, read 14 Nov 2026
    pool("mezo-pool-mezo-musd-200", "Mezo pool MEZO/MUSD-200", "Concentrated volatile", 5_795, { stakedUsd: 3_800, emissionsApr: 1_095 }, "MEZO"),
    dittoVenue(104_230, at), // Mezo app TVL, 9 Nov 2026
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
    mezoPriceSource: "Merkl",
    peg: { priceUsd: 0.9913, floorUsd: 0.9925, redemptionPct: 0.75, pool: MAINNET.pools.musdcMusdCl10, updatedAt: at, depthMusd: 121_174, depthUsdc: 120_070, depthFloorUsd: 0.99 },
  };
}
