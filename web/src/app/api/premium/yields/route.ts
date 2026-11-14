import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { declareEip2612GasSponsoringExtension } from "@x402/extensions";
import { withX402 } from "@x402/next";
import { after, NextResponse, type NextRequest } from "next/server";
import type { PublicClient } from "viem";
import { mezoClient } from "@/lib/chain/clients";
import { allow, tooMany } from "@/lib/rateLimit";
import { loadSources } from "@/lib/sources";
import { countCall, countPayment } from "@/lib/stats";
import { fetchUserRewards } from "@/lib/sources/merkl";
import { publicTrove, readTrove } from "@/lib/trove";
import { toWallet } from "@/lib/vault";
import { premiumAccepts, X402_NETWORKS } from "@/lib/x402";
import { buildYields, parseQuery } from "@/lib/yields";

export const maxDuration = 300; // same cold fill as /api/yields

// Docs: @x402/next README (withX402 settles only when the handler answers < 400).
// Both Mezo networks are registered; the facilitator lists MUSD on eip155:31611 and eip155:31612 (its /supported, 3 Nov 2026).
// Mainnet is only advertised when X402_MAINNET_PAY_TO names a payee (see premiumAccepts).
const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: process.env.X402_FACILITATOR_URL ?? "https://facilitator.vativ.io" }))
  .register(X402_NETWORKS.testnet, new ExactEvmScheme())
  .register(X402_NETWORKS.mainnet, new ExactEvmScheme());

// Browsers may call this from any site: they need to read the x402 headers and send the payment one.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE" };

function readQuery(sp: URLSearchParams) {
  const parsed = parseQuery(sp);
  if (!parsed.ok) return { error: parsed.error };
  const raw = sp.get("address");
  const address = raw ? toWallet(raw) : null;
  if (raw && !address) return { error: "address must be an EVM address." };
  return { query: parsed.query, address };
}

/** One agent-friendly bundle: every mode × holding period, plus planner and rewards for an address. */
async function handler(req: NextRequest): Promise<NextResponse<unknown>> {
  const q = readQuery(req.nextUrl.searchParams);
  if (q.error !== undefined) return NextResponse.json({ error: q.error }, { status: 400 }); // GET already refused it, before any payment
  const { query, address } = q;
  const sources = await loadSources();
  const carry = (["holder", "borrower"] as const).flatMap((mode) =>
    ([30, 90, 365] as const).map((days) => ({ mode, days, ...buildYields(sources, { ...query, mode, days }) })),
  );
  const [rewards, trove] = address
    ? await Promise.all([
        fetchUserRewards(address).catch(() => null),
        readTrove(mezoClient as PublicClient, address, sources.borrow.feePct, null).then(publicTrove).catch(() => null),
      ])
    : [null, null];
  return NextResponse.json({ amount: query.amount, carry, rewards, trove, paidOn: "MUSD via x402 on Mezo" });
}

const paid = withX402(
  handler,
  {
    accepts: premiumAccepts(process.env.X402_MAINNET_PAY_TO),
    description: "MUSD Compass premium bundle: carry for every mode and holding period, plus trove and rewards for an address",
    extensions: { ...declareEip2612GasSponsoringExtension() }, // exact-amount EIP-2612 permit only; never the unlimited ERC-20 approval extension
  },
  server,
);

export async function GET(req: NextRequest) {
  const res = await gate(req);
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "PAYMENT-SIGNATURE, X-PAYMENT" } });
}

async function gate(req: NextRequest): Promise<Response> {
  if (!allow(req)) return tooMany();
  after(() => countCall("premium", req));
  // Bad input is a 400 before the 402: nobody should be asked to pay for a request that cannot succeed.
  const bad = readQuery(req.nextUrl.searchParams).error;
  if (bad !== undefined) return NextResponse.json({ error: bad }, { status: 400 });
  // zod 3 inside @x402 can exhaust memory on oversized input (GHSA-mrhx-c7xc-m3w5): refuse big payment headers before parsing.
  const size = (req.headers.get("payment-signature")?.length ?? 0) + (req.headers.get("x-payment")?.length ?? 0);
  if (size > 16_384) return NextResponse.json({ error: "Payment header too large." }, { status: 431 });
  const res = await paid(req);
  // Only a settled 200 counts as a payment; a 402 or failed settlement carries no settlement header.
  if (res.status === 200) {
    const settled = res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("X-PAYMENT-RESPONSE");
    after(() => countPayment(settled));
  }
  // @x402/next answers a generic 500 when it can't sync with the facilitator (it retries on the next request).
  if (res.status !== 500) return res;
  return NextResponse.json({ error: "The x402 payment service is unavailable right now — try again in a minute. The free /api/yields has the same numbers." }, { status: 503 });
}
