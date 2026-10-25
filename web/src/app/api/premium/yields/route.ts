import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareEip2612GasSponsoringExtension } from "@x402/extensions";
import { withX402 } from "@x402/next";
import { NextResponse, type NextRequest } from "next/server";
import type { PublicClient } from "viem";
import { mezoClient } from "@/lib/chain/clients";
import { allow } from "@/lib/rateLimit";
import { loadSources } from "@/lib/sources";
import { fetchUserRewards } from "@/lib/sources/merkl";
import { readTrove } from "@/lib/trove";
import { isWallet } from "@/lib/vault";
import { PAY_TO, PREMIUM_PRICE, X402_NETWORK } from "@/lib/x402";
import { buildYields, parseQuery } from "@/lib/yields";

export const maxDuration = 60;

// Docs: @x402/next README (withX402 settles only when the handler answers < 400).
const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: process.env.X402_FACILITATOR_URL ?? "https://facilitator.vativ.io" })).register(
  X402_NETWORK,
  new ExactEvmScheme(),
);

/** One agent-friendly bundle: every mode × holding period, plus planner and rewards for an address. */
async function handler(req: NextRequest): Promise<NextResponse<unknown>> {
  const sp = req.nextUrl.searchParams;
  const parsed = parseQuery(sp);
  const raw = sp.get("address");
  const address = raw && isWallet(raw) ? raw : null;
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (raw && !address) return NextResponse.json({ error: "address must be an EVM address." }, { status: 400 });
  const sources = await loadSources();
  const carry = (["holder", "borrower"] as const).flatMap((mode) =>
    ([30, 90, 365] as const).map((days) => ({ mode, days, ...buildYields(sources, { ...parsed.query, mode, days }) })),
  );
  const [rewards, trove] = address
    ? await Promise.all([
        fetchUserRewards(address).catch(() => null),
        readTrove(mezoClient as PublicClient, address, sources.borrow.feePct, null).catch(() => null),
      ])
    : [null, null];
  return NextResponse.json({ amount: parsed.query.amount, carry, rewards, trove, paidOn: "Mezo testnet (MUSD via x402)" });
}

const paid = withX402(
  handler,
  {
    accepts: [{ scheme: "exact", price: PREMIUM_PRICE, network: X402_NETWORK, payTo: PAY_TO }],
    description: "MUSD Compass premium bundle: carry for every mode and holding period, plus trove and rewards for an address",
    extensions: { ...declareEip2612GasSponsoringExtension() }, // exact-amount EIP-2612 permit only; never the unlimited ERC-20 approval extension
  },
  server,
);

export async function GET(req: NextRequest) {
  if (!allow(req)) return NextResponse.json({ error: "Too many requests — try again in a minute." }, { status: 429 });
  // zod 3 inside @x402 can exhaust memory on oversized input (GHSA-mrhx-c7xc-m3w5): refuse big payment headers before parsing.
  const size = (req.headers.get("payment-signature")?.length ?? 0) + (req.headers.get("x-payment")?.length ?? 0);
  if (size > 16_384) return NextResponse.json({ error: "Payment header too large." }, { status: 431 });
  const res = await paid(req);
  // @x402/next answers a generic 500 when it can't sync with the facilitator (it retries on the next request).
  if (res.status !== 500) return res;
  return NextResponse.json({ error: "The x402 payment service is unavailable right now — try again in a minute. The free /api/yields has the same numbers." }, { status: 503 });
}
