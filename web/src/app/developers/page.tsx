import type { Metadata } from "next";
import { PayAndFetch } from "@/components/PayAndFetch";
import { SiteHeader } from "@/components/SiteHeader";
import { SAMPLES } from "@/lib/chain/addresses";

export const metadata: Metadata = { title: "API and widget · MUSD Compass" };

const BASE = "https://musd-compass.vercel.app";
const SECTION = "rounded-[20px] border border-line bg-card px-5 py-5";
const H2 = "text-base font-bold";
const CODE = "mt-2 rounded-xl bg-surface p-3 text-xs leading-relaxed whitespace-pre-wrap break-all";

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className={H2}>
      {children}
    </h2>
  );
}

function Code({ children, label }: { children: string; label: string }) {
  // Wraps instead of scrolling, so a phone shows the whole command.
  return (
    <pre className={CODE} aria-label={label}>
      <code>{children}</code>
    </pre>
  );
}

const PARAMS: [string, string][] = [
  ["amount", "MUSD, 1 – 10,000,000 (default 2000)"],
  ["mode", "holder or borrower (default holder)"],
  ["trove", "new or existing, for borrower mode (default new)"],
  ["days", "holding period: 30, 90 or 365 (default 90)"],
  ["rate", "borrow rate, 1 – 5 % per year (default: the live Mezo rate)"],
];

const FIELDS: [string, string][] = [
  ["carry.cash", "% per year you can spend: liquid APR minus costs spread over the holding period. Venues are sorted by this, except that pools which also need BTC or MEZO (pairToken) come after every MUSD-only venue."],
  ["carry.total", "cash plus 🔒 locked veMEZO (12-week lock, valued at MEZO spot). Never counted as cash."],
  ["carry.costs", "% per year of entry/exit costs (Ethereum bridge + gas round trip, borrow fee and interest)."],
  ["breakEven", "Ethereum venues only: the amounts where the venue beats the Savings Vault, for cash and total."],
  ["status", "ok or unavailable — a source that is down says so instead of guessing."],
  ["assumptions", "the holding period, borrow parameters and costs used, with plain-language labels. assumptions.peg is MUSD's price on Mezo's MUSD/mUSDC pool (mUSDC counted as $1) and the redemption floor (1 minus the redemption fee), or null when unread. It also carries depthMusd and depthUsdc (MUSD the pool can absorb before MUSD falls below depthFloorUsd, $0.99, and the mUSDC it pays out; null when the tick read failed)."],
  ["mezoSellDepthMusd", "MEZO-paid venues only: the MUSD the Mezo MEZO/MUSD pool holds to pay people who sell MEZO, so you can see how much reward can be turned into MUSD."],
  ["incentiveUsdPerDay", "Merkl venues only: what the reward campaign pays out per day, in USD."],
  ["notice", "a sentence to show the user as-is, e.g. when an amount is below the new-trove minimum."],
];

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader current="/developers" />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
        <div>
          <h1 className="text-[30px] leading-tight font-extrabold tracking-tight md:text-[40px]">
            API and widget
          </h1>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            The same numbers the page shows, as JSON. Free, no key, CORS open. 60 requests per minute per IP; sources refresh every 5 minutes.
          </p>
        </div>

        <section aria-labelledby="yields-h" className={SECTION}>
          <H id="yields-h">GET /api/yields</H>
          <p className="mt-1 text-sm">Every MUSD venue on Mezo and Ethereum, ranked by cash carry. Mainnet data.</p>
          <Code label="Example: yields request">{`curl "${BASE}/api/yields?amount=2000&mode=holder&days=90"`}</Code>
          <table className="mt-3 w-full text-left text-sm">
            <caption className="sr-only">Query parameters</caption>
            <thead>
              <tr className="border-b border-line text-xs text-ink-muted">
                <th scope="col" className="py-1 pr-3 font-semibold">Parameter</th>
                <th scope="col" className="py-1 font-semibold">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {PARAMS.map(([k, v]) => (
                <tr key={k} className="border-b border-line align-top">
                  <th scope="row" className="py-1.5 pr-3 font-mono text-xs font-semibold">{k}</th>
                  <td className="py-1.5">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="mt-4 text-sm font-bold">Fields to know</h3>
          <dl className="mt-1 space-y-1.5 text-sm">
            {FIELDS.map(([k, v]) => (
              <div key={k}>
                <dt className="inline font-mono text-xs font-semibold">{k}</dt> <dd className="inline">— {v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm">
            <a href="/api/yields?amount=2000" className="font-semibold underline">Open the live JSON</a>
          </p>
        </section>

        <section aria-labelledby="vault-h" className={SECTION}>
          <H id="vault-h">GET /api/vault/&#123;address&#125;</H>
          <p className="mt-1 text-sm">A Savings Vault position on Mezo testnet: wallet MUSD, sMUSD in the vault, allowance, pending yield, last distribution. Never cached.</p>
          <Code label="Example: vault request">{`curl "${BASE}/api/vault/${SAMPLES.devWallet}"`}</Code>
        </section>

        <section aria-labelledby="rewards-h" className={SECTION}>
          <H id="rewards-h">GET /api/rewards/&#123;address&#125;</H>
          <p className="mt-1 text-sm">Unclaimed veMEZO from Mezo&apos;s Merkl campaigns (amount − claimed), its value at MEZO spot, what is not claimable yet, and when the current campaigns end. Never cached.</p>
          <Code label="Example: rewards request">{`curl "${BASE}/api/rewards/${SAMPLES.rewards}"`}</Code>
        </section>

        <section aria-labelledby="trove-h" className={SECTION}>
          <H id="trove-h">GET /api/trove/&#123;address&#125;</H>
          <p className="mt-1 text-sm">A Mezo mainnet trove: collateral, debt, collateral ratio, its interest rate, how many troves are redeemed before it, and the extra MUSD it can borrow while staying at or above 200%. Use <code className="font-mono text-xs">sample</code> as the address for the safest live trove.</p>
          <Code label="Example: trove request">{`curl "${BASE}/api/trove/sample"`}</Code>
        </section>

        <section aria-labelledby="positions-h" className={SECTION}>
          <H id="positions-h">GET /api/positions/&#123;address&#125;</H>
          <p className="mt-1 text-sm">
            Where an address&apos;s MUSD sits on Mezo mainnet, read only: <code className="font-mono text-xs">wallet</code> (idle MUSD), <code className="font-mono text-xs">vault</code> (Savings Vault), <code className="font-mono text-xs">staked</code> (sMUSD in the vault&apos;s gauge) and{" "}
            <code className="font-mono text-xs">stakedApr</code> (what staking pays in MEZO, % per year), <code className="font-mono text-xs">stability</code> (Stability Pool deposit), <code className="font-mono text-xs">trove</code> (debt and rate, null without an open trove) and{" "}
            <code className="font-mono text-xs">veMezo</code> (unclaimed veMEZO and its USD value). A field is null when its source could not be read. Never cached.
          </p>
          <Code label="Example: positions request">{`curl "${BASE}/api/positions/${SAMPLES.devWallet}"`}</Code>
        </section>

        <section aria-labelledby="health-h" className={SECTION}>
          <H id="health-h">GET /api/health</H>
          <p className="mt-1 text-sm">Can the server reach each upstream right now (Mezo mainnet + fallback, Mezo testnet, Ethereum, Merkl)? 503 if any fails.</p>
        </section>

        <section aria-labelledby="premium-h" className={SECTION}>
          <H id="premium-h">GET /api/premium/yields (x402, paid in MUSD)</H>
          <p className="mt-1 text-sm">
            For agents: one call returns carry for both modes × all three holding periods; add <code className="font-mono text-xs">&amp;address=</code> for that address&apos;s trove and unclaimed veMEZO. Same numbers as the free API — you pay for the bundle, not for hidden data. Without payment it answers 402 with the price.
          </p>
          <Code label="Example: premium request without payment">{`curl -i "${BASE}/api/premium/yields?amount=2000"   # 402 + PAYMENT-REQUIRED header`}</Code>
          <PayAndFetch />
          <h3 className="mt-4 text-sm font-bold">Price per call</h3>
          <table className="mt-1 w-full max-w-prose text-left text-sm">
            <caption className="sr-only">Price per premium call, by network</caption>
            <thead>
              <tr className="text-xs text-ink-muted">
                <th scope="col" className="py-1 pr-3 font-semibold">Network</th>
                <th scope="col" className="py-1 pr-3 font-semibold">Price</th>
                <th scope="col" className="py-1 pr-3 font-semibold">Per 1,000 calls</th>
                <th scope="col" className="py-1 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line align-top">
                <td className="py-2 pr-3">Mezo testnet</td>
                <td className="py-2 pr-3">0.001 test MUSD</td>
                <td className="py-2 pr-3">1 test MUSD</td>
                <td className="py-2">Live. The Pay &amp; fetch button uses it.</td>
              </tr>
              <tr className="border-t border-line align-top">
                <td className="py-2 pr-3">Mezo mainnet</td>
                <td className="py-2 pr-3">0.01 MUSD</td>
                <td className="py-2 pr-3">10 MUSD</td>
                <td className="py-2">Live. Listed in the 402 response next to testnet; pay it with the button above (choose Mezo mainnet) or from your own x402 client. The curl above shows both.</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 max-w-prose text-xs text-ink-muted">Both are exact payments in MUSD over x402, and the facilitator sponsors the gas.</p>

          <h3 className="mt-4 text-sm font-bold">Who pays, and why</h3>
          <p className="mt-1 max-w-prose text-sm">
            Anyone who needs this answer for many amounts or many addresses from one server, or an agent that cannot sign up for an API key and just pays per call.
          </p>
          <ul className="mt-2 max-w-prose list-disc space-y-1 pl-5 text-sm">
            <li>A wallet or app that shows where to put MUSD reads the <code className="font-mono text-xs">carry</code> list and shows one answer, without running a venue adapter for each place.</li>
            <li>An agent that rebalances compares holding with borrowing at 30, 90 and 365 days in one response, and reads <code className="font-mono text-xs">trove</code> to keep a position above 200% before it acts.</li>
            <li>An alert or notification bot passes a user&apos;s address and gets <code className="font-mono text-xs">rewards</code> (unclaimed veMEZO) and <code className="font-mono text-xs">trove</code> (the ratio) next to the carry numbers.</li>
          </ul>
          <p className="mt-2 max-w-prose text-sm">
            The paid call replaces eight free requests: six combinations of mode and holding period, plus rewards and trove for an address. The free API allows 60 requests a minute per IP, so one server fits about 7 full lookups a minute on the free tier and 60 with the paid call.
            Reading the chain yourself is heavier still: 14 days of sMUSD yield events alone take 34 <code className="font-mono text-xs">eth_getLogs</code> requests on Mezo mainnet, because its RPCs cap a request at 10,000 blocks.
          </p>
          <p className="mt-2 max-w-prose text-sm">
            The payers we expect: bot and agent developers who need every mode and holding period, plus an address&apos;s trove and rewards, in one call, and treasury dashboards that track a trove and its rewards.
            Every payment on record is ours, from our own wallets (each one is listed on{" "}
            <a href="/proof" className="font-semibold underline">/proof</a>). There are no outside payers yet; the live count is on{" "}
            <a href="/stats" className="font-semibold underline">/stats</a>.
          </p>

          <h3 className="mt-4 text-sm font-bold">What it costs us, and what it costs you to do it yourself</h3>
          <p className="mt-1 max-w-prose text-sm">
            Our serving cost is an estimate of about $0.004 per 1,000 calls at Vercel Pro on-demand prices, for calls answered from the warm cache. Basis: Vercel Fluid compute, region iad1 (
            <a href="https://vercel.com/docs/functions/usage-and-pricing" className="font-semibold underline">pricing page</a>, read 8 Nov 2026): Active CPU $0.128 per hour, Provisioned Memory $0.0106 per GB-hour, Invocations $0.60 per million.
            Assumptions: 50 ms active CPU and 0.3 s wall time per call, 2 GB, no instance sharing. That is about $0.0018 for CPU, $0.0018 for memory and $0.0006 for invocations. The x402 facilitator pays the settlement gas, not Compass.
            The estimate uses Vercel Pro on-demand prices, which is what paid traffic would run on.
          </p>
          <p className="mt-2 max-w-prose text-sm">
            Doing it yourself: one refresh needs 34 <code className="font-mono text-xs">eth_getLogs</code> requests for 14 days of sMUSD yield events alone (Mezo RPCs cap a request at 10,000 blocks), plus pool, trove, gauge and Merkl reads. We measured 7 to 37 seconds per cold refresh on 4 Nov 2026, depending on the RPC.
          </p>
        </section>

        <section aria-labelledby="inc-h" className={SECTION}>
          <H id="inc-h">Incentive efficiency</H>
          <p className="mt-1 text-sm">
            For the Mezo team: what each Mezo-paid campaign spends per day against the liquidity it holds, on{" "}
            <a href="/incentives" className="font-semibold underline">/incentives</a>. The same numbers are in <code className="font-mono text-xs">incentiveUsdPerDay</code> and <code className="font-mono text-xs">tvlUsd</code> of <code className="font-mono text-xs">/api/yields</code>.
          </p>
        </section>

        <section aria-labelledby="embed-h" className={SECTION}>
          <H id="embed-h">Widget for any website</H>
          <p className="mt-1 text-sm">One tag adds the top 3 venues by cash carry, with the data and holding labels and a link back to the full table.</p>
          <Code label="Widget embed tag">{`<script src="${BASE}/embed.js" data-amount="2000" async></script>`}</Code>
        </section>

        <section aria-labelledby="bot-h" className={SECTION}>
          <H id="bot-h">Telegram bot</H>
          <p className="mt-1 text-sm">
            <a href="https://t.me/musd_compass_bot" className="font-semibold underline">@musd_compass_bot</a> answers <code className="font-mono text-xs">/yield [amount]</code>,{" "}
            <code className="font-mono text-xs">/carry &lt;amount&gt; [borrow]</code> and <code className="font-mono text-xs">/vault &lt;address&gt;</code> from this API.
          </p>
        </section>
      </main>
    </>
  );
}
