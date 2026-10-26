import type { PublicClient } from "viem";
import { mezoClient } from "@/lib/chain/clients";
import { readPositions, type Positions } from "@/lib/positions";
import { allow } from "@/lib/rateLimit";
import { fetchMerkl, fetchUserRewards } from "@/lib/sources/merkl";
import { isWallet } from "@/lib/vault";

export const maxDuration = 60;
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

const FIXTURE: Omit<Positions, "address"> = {
  wallet: 1250,
  vault: 4000,
  staked: 0,
  stability: 800,
  trove: { debt: 30_210.4, ratePct: 1 },
  veMezo: { unclaimed: 239.28, usd: 4.21 },
};

/** Where an address's MUSD sits on Mezo mainnet. Read only. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  if (!allow(req))
    return Response.json(
      { error: "Too many requests — try again in a minute." },
      { status: 429, headers: HEADERS },
    );
  const { address } = await params;
  if (!isWallet(address))
    return Response.json(
      { error: "That is not an EVM address (0x… with 40 hex characters)." },
      { status: 400, headers: HEADERS },
    );
  if (process.env.COMPASS_FIXTURES === "1")
    return Response.json(
      { address, ...FIXTURE, network: "Mezo mainnet" },
      { headers: HEADERS },
    );

  try {
    const [chain, rewards, merkl] = await Promise.all([
      readPositions(mezoClient as PublicClient, address),
      fetchUserRewards(address).catch(() => null), // optional: the rest still answers without Merkl
      fetchMerkl().catch(() => ({ mezoPriceUsd: null })),
    ]);
    const price = merkl.mezoPriceUsd;
    const veMezo = rewards
      ? {
          unclaimed: rewards.unclaimed,
          usd: price === null ? null : rewards.unclaimed * price,
        }
      : null;
    return Response.json(
      { ...chain, veMezo, network: "Mezo mainnet" } satisfies Positions & {
        network: string;
      },
      { headers: HEADERS },
    );
  } catch {
    return Response.json(
      {
        error: "Mezo mainnet is unavailable right now — try again in a minute.",
      },
      { status: 503, headers: HEADERS },
    );
  }
}
