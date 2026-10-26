import { allow } from "@/lib/rateLimit";
import { loadSources } from "@/lib/sources";
import { fetchMerkl, fetchUserRewards } from "@/lib/sources/merkl";
import { isWallet } from "@/lib/vault";

export const maxDuration = 60;
const HEADERS = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };

// Facts behind every line: docs/design.md §6 and verification log #8, #9b.
const ABOUT = {
  warning: "No published claim deadline, but unclaimed rewards can be reallocated after a campaign ends — claim soon.",
  gas: "Claiming happens on Mezo and needs a little BTC there for gas (about $0.02).",
  path: [
    "Earn: provide MUSD liquidity on Ethereum (Curve, Uniswap V4).",
    "Claim on Merkl — the reward is paid on Mezo.",
    "It arrives as veMEZO, locked 12 weeks.",
    "Use it on Mezo through Matchbox or Boar.",
  ],
  claimUrl: "https://app.merkl.xyz",
};

export async function GET(req: Request, { params }: { params: Promise<{ address: string }> }) {
  if (!allow(req)) return Response.json({ error: "Too many requests — try again in a minute." }, { status: 429, headers: HEADERS });
  const { address } = await params;
  if (!isWallet(address)) return Response.json({ error: "That is not an EVM address (0x… with 40 hex characters)." }, { status: 400, headers: HEADERS });

  const fixtures = process.env.COMPASS_FIXTURES === "1";
  const [rewards, sources] = await Promise.all([
    fixtures ? Promise.resolve({ unclaimed: 239.28, pending: 12.5 }) : fetchUserRewards(address).catch(() => null),
    // Only the MEZO price and campaign dates are needed: Merkl's cached listing, not every source (one of
    // them is a 14-day chain scan that made this answer slow on a cold cache).
    fixtures ? loadSources() : fetchMerkl().catch(() => ({ venues: [], mezoPriceUsd: null })),
  ]);
  if (!rewards) return Response.json({ error: "Merkl is unavailable right now — try again in a minute." }, { status: 503, headers: HEADERS });

  const price = sources.mezoPriceUsd;
  const now = Date.now();
  const ends = sources.venues
    .filter((v) => v.rates.lockedApr !== null && v.ends && Date.parse(v.ends) > now)
    .map((v) => v.ends as string)
    .sort()[0] ?? null;
  return Response.json(
    {
      address,
      network: "Mezo mainnet",
      token: "veMEZO",
      unclaimed: rewards.unclaimed,
      pending: rewards.pending,
      usd: price === null ? null : rewards.unclaimed * price,
      mezoPriceUsd: price,
      campaignEnds: ends,
      ...ABOUT,
    },
    { headers: HEADERS },
  );
}
