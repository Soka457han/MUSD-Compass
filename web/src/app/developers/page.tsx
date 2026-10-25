import type { Metadata } from "next";
import { PayAndFetch } from "@/components/PayAndFetch";
import { SiteHeader } from "@/components/SiteHeader";
import { SAMPLES } from "@/lib/chain/addresses";

export const metadata: Metadata = { title: "API and widget · MUSD Compass" };

const BASE = "https://musd-compass.vercel.app";
const SECTION = "border-t-4 border-ink bg-label px-4 py-4";
const H2 = "text-base font-bold";
const CODE = "mt-2 rounded-sm bg-shelf p-3 text-xs leading-relaxed whitespace-pre-wrap break-all";

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className={H2} style={{ fontStretch: "90%" }}>
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
  ["carry.cash", "% per year you can spend: liquid APR minus costs spread over the holding period. Venues are sorted by this."],
  ["carry.total", "cash plus 🔒 locked veMEZO (12-week lock, valued at MEZO spot). Never counted as cash."],
  ["carry.costs", "% per year of entry/exit costs (Ethereum bridge + gas round trip, borrow fee and interest)."],
  ["breakEven", "Ethereum venues only: the amounts where the venue beats the Savings Vault, for cash and total."],
  ["status", "ok or unavailable — a source that is down says so instead of guessing."],
  ["assumptions", "the holding period, borrow parameters and costs used, with plain-language labels."],
  ["notice", "a sentence to show the user as-is, e.g. when an amount is below the new-trove minimum."],
];

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader current="/developers" />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ fontStretch: "88%" }}>
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
