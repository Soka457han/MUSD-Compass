import Link from "next/link";

const BOT = process.env.NEXT_PUBLIC_BOT_URL ?? "https://t.me/musd_compass_bot";
const REPO = "https://github.com/Soka457han/MUSD-Compass";
const H2 = "text-2xl leading-tight font-extrabold tracking-tight md:text-[32px]";

const STEPS = [
  { title: "Say what you have", body: "Type an amount, pick hold or borrow, and choose 30, 90 or 365 days." },
  { title: "Compass takes off the costs", body: "Gas, bridge fees and trove interest come off each venue, spread over the days you chose." },
  { title: "Pick one and go", body: "The list is sorted by the cash you keep. Each row links to its venue, and the vault deposit runs here on testnet." },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-h">
      <h2 id="how-h" className={H2}>
        How Compass ranks them
      </h2>
      <ol className="mt-4 grid gap-2.5 md:mt-6 md:grid-cols-3 md:gap-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[40px_1fr] gap-3.5 rounded-[18px] border border-line bg-card px-5 py-[18px] md:flex md:flex-col md:gap-3 md:rounded-[20px] md:p-7">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent font-extrabold text-on-accent md:size-11 md:text-lg" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              <strong className="block text-base md:mt-2 md:text-xl">{s.title}</strong>
              <span className="text-sm text-ink-muted md:text-base">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const TRUST = [
  { title: "Vault yield from its own payouts", body: "The Savings Vault rate is worked out from the vault's payout events over the last 14 days." },
  { title: "Rewards from Merkl", body: "Pool reward rates come from the Merkl campaigns that pay them." },
  { title: "Locked stays separate", body: "veMEZO sits next to the cash figure and is never added to it." },
  { title: "Every number has a time", body: 'The footer shows when the data was read. If a source cannot be read and there is no recent copy, that venue reads "unavailable".' },
  { title: "Your funds stay with you", body: "Compass holds no funds and no keys. Approvals are for the exact amount you deposit." },
];

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 size-[22px] md:size-6" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--accent-soft)" />
      <path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="var(--accent-text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Trust() {
  return (
    <section aria-labelledby="trust-h" className="md:grid md:grid-cols-[1fr_1.4fr] md:items-start md:gap-12">
      <div className="flex flex-col gap-2 md:gap-4">
        <h2 id="trust-h" className={H2}>
          Where the numbers come from
        </h2>
        <p className="text-ink-muted md:text-lg">Every figure has a source link and the assumption behind it.</p>
        <a href={`${REPO}#testnet-proof-mezo-testnet-chain-31611`} className="mt-2 hidden h-12 items-center self-start rounded-full border border-line px-[22px] font-semibold no-underline md:inline-flex">
          See the testnet transactions
        </a>
      </div>
      <ul className="mt-4 overflow-hidden rounded-[18px] border border-line md:mt-0 md:rounded-[20px]">
        {TRUST.map((t, i) => (
          <li key={t.title} className={`grid grid-cols-[28px_1fr] gap-3 px-[18px] py-4 md:grid-cols-[40px_1fr] md:gap-4 md:px-7 md:py-[22px] ${i ? "border-t border-line" : ""}`}>
            <Check />
            <span>
              <strong className="block">{t.title}</strong>
              <span className="text-sm text-ink-muted md:text-base">{t.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <a href={`${REPO}#testnet-proof-mezo-testnet-chain-31611`} className="mt-3 flex h-12 items-center justify-center rounded-full border border-line font-semibold no-underline md:hidden">
        See the testnet transactions
      </a>
    </section>
  );
}

const CHANNELS = [
  { title: "Telegram bot", body: "Yields, carry, vault, rewards and trove checks in a chat.", code: "@musd_compass_bot", href: BOT, bg: "bg-tile-blue" },
  { title: "Embed widget", body: "One script tag puts the ranking on your own site.", code: '<script src=".../embed.js">', href: "/developers", bg: "bg-tile-mint" },
  { title: "JSON API", body: "Free and open, no key needed.", code: "GET /api/yields", href: "/developers", bg: "bg-tile-lilac" },
  { title: "x402 premium", body: "A bundled report paid per call from your wallet.", code: "0.001 test MUSD", href: "/developers", bg: "bg-tile-yellow" },
];

export function Channels() {
  return (
    <section aria-labelledby="any-h">
      <h2 id="any-h" className={H2}>
        Same numbers, other places
      </h2>
      <p className="mt-2 text-ink-muted md:mt-3 md:text-lg">The site, the bot, the widget and the API all read the same ranking.</p>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 md:mt-6 md:grid-cols-4 md:gap-4">
        {CHANNELS.map((c) => (
          <li key={c.title} className="min-w-0">
            <a href={c.href} className={`flex h-full min-w-0 flex-col gap-1.5 rounded-[18px] p-4 text-tile-ink no-underline md:min-h-[200px] md:gap-2.5 md:rounded-[20px] md:p-6 ${c.bg}`}>
              <h3 className="text-[15px] font-bold md:text-lg">{c.title}</h3>
              <p className="flex-1 text-[13px] text-tile-ink-muted md:text-base">{c.body}</p>
              <code className="max-w-full self-start truncate rounded-lg bg-[rgb(22_23_29/0.08)] px-2 py-0.5 font-mono text-xs md:text-[13px]">{c.code}</code>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

const FAQ = [
  { q: "What is veMEZO?", a: "Mezo's vote-escrowed token. Rewards paid in it are locked for 12 weeks, so Compass shows them beside the cash figure." },
  { q: "Why can I only deposit on testnet?", a: "Wave 1 sends transactions to Mezo testnet only. The rates you see come from mainnet. Mainnet deposits come after a review." },
  { q: "Does it work with a phone wallet?", a: "Reading the ranking works in any phone browser. To deposit from a phone, open Compass in your wallet app's built-in browser. WalletConnect for other phone wallets is planned for Wave 2." },
  { q: "Is this financial advice?", a: "No. It is arithmetic on public data. Check the source link on a number before you move money." },
];

export function Faq() {
  return (
    <section aria-labelledby="faq-h" className="md:grid md:grid-cols-[1fr_1.4fr] md:items-start md:gap-12">
      <h2 id="faq-h" className={H2}>
        Questions
      </h2>
      <div className="mt-4 flex flex-col gap-2 md:mt-0 md:gap-2.5">
        {FAQ.map((f, i) => (
          <details key={f.q} open={i === 0} className="group rounded-2xl border border-line bg-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-[18px] text-[15px] font-bold md:min-h-[60px] md:px-6 md:text-[17px] [&::-webkit-details-marker]:hidden">
              {f.q}
              <span aria-hidden="true" className="text-xl text-ink-muted">
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">−</span>
              </span>
            </summary>
            <p className="px-[18px] pb-4 text-sm text-ink-muted md:px-6 md:pb-5 md:text-base">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function SiteFooter({ notes }: { notes?: React.ReactNode }) {
  return (
    <footer className="mt-14 border-t border-line md:mt-24">
      {notes && <div className="mx-auto max-w-6xl space-y-1.5 px-4 pt-7 text-xs leading-relaxed text-ink-muted md:px-6 md:pt-10">{notes}</div>}
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-7 text-sm md:grid-cols-[1.4fr_1fr_1fr] md:gap-8 md:px-6 md:py-10 md:text-[15px]">
        <div className="flex flex-col gap-2.5">
          <span className="text-[17px] font-bold md:text-lg">MUSD Compass</span>
          <span className="text-ink-muted">Built for the Mezo Buildathon. Mainnet data, testnet actions. Not financial advice. Independent community tool, not made by Mezo.</span>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-muted">Product</span>
          {/* The footer lives on the Yields page itself, so this link jumps up instead of reloading the page. */}
          <a href="#main" className="flex min-h-10 items-center no-underline hover:underline">
            Yields
          </a>
          {[
            ["/my", "My MUSD"],
            ["/vault", "Savings Vault"],
            ["/rewards", "Rewards"],
            ["/trove", "Trove planner"],
          ].map(([href, label]) => (
            <Link key={href} href={href} prefetch={false} className="flex min-h-10 items-center no-underline hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Elsewhere" className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-muted">Elsewhere</span>
          {[
            [REPO, "GitHub"],
            [BOT, "Telegram bot"],
            ["/developers", "Developers"],
            ["https://mezo.org", "Mezo"],
          ].map(([href, label]) => (
            <a key={href + label} href={href} className="flex min-h-10 items-center no-underline hover:underline">
              {label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
