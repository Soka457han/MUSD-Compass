import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { storeConfigured } from "@/lib/store";
import { readStats, ROUTES, type Route } from "@/lib/stats";

export const metadata: Metadata = { title: "Usage stats · MUSD Compass" };

const TX = "https://explorer.test.mezo.org/tx/0x3a63cdf86569c3787867fcc9ddb3ebf8c91eb8dec1a2a206c716457f8c30bc5a";
const CARD = "rounded-[20px] border border-line bg-card px-5 py-5";
const TILE = "rounded-[20px] bg-tile-lilac px-4 py-4 text-tile-ink";
const LABEL: Record<Route, string> = { yields: "Yields API", premium: "Paid (x402) API", trove: "Trove API", embed: "Widget" };
const fmt = (n: number) => n.toLocaleString("en-US");

function Tile({ title, big, note, since }: { title: string; big: string; note: string; since: string | null }) {
  return (
    <li className={TILE}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-[28px] leading-none font-extrabold">{big}</p>
      <p className="mt-2 text-xs text-tile-ink-muted">
        {note}
        {since ? ` Counting since ${since}.` : ""}
      </p>
    </li>
  );
}

function Highlights({ embedded }: { embedded: string }) {
  return (
    <ul className="space-y-3">
      <li className={`${CARD} text-sm`}>
        <a href={TX} className="font-semibold underline">
          Paid from a second wallet
        </a>
        <span className="block text-ink-muted">Our own second test wallet paid the dev wallet (payer is not the payee) on Mezo testnet. Open the transaction on the explorer.</span>
      </li>
      <li className={`${CARD} text-sm`}>
        <span className="font-semibold">Embedded on another site: </span>
        {embedded}
      </li>
    </ul>
  );
}

async function Live() {
  // Per request, not at build time (same reason as /my).
  await connection();
  const s = await readStats();
  if (!s && storeConfigured()) {
    return (
      <>
        <Highlights embedded="not counted yet" />
        <p className={`${CARD} text-sm`}>Usage numbers are unavailable right now.</p>
      </>
    );
  }
  if (!s) {
    return (
      <>
        <Highlights embedded="not counted yet" />
        <p className={`${CARD} text-sm`}>Counting is not switched on in this deployment yet. Nothing is shown here until it is, so you never see made-up zeros.</p>
      </>
    );
  }
  const outside = s.embedHosts.length;
  const net = (k: "testnet" | "mainnet") => s.x402[k];
  return (
    <>
      <Highlights embedded={outside ? `${outside} outside site${outside === 1 ? "" : "s"}` : "none yet"} />
      <section aria-labelledby="calls-h" className="space-y-3">
        <h2 id="calls-h" className="text-base font-bold">Requests</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {ROUTES.map((r) => (
            <Tile key={r} title={LABEL[r]} big={fmt(s.calls[r].last7)} note={`requests in the last 7 days, ${fmt(s.calls[r].total)} in total.`} since={s.since} />
          ))}
        </ul>
      </section>
      <section aria-labelledby="bot-h" className="space-y-3">
        <h2 id="bot-h" className="text-base font-bold">Telegram bot</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <Tile title="Bot users" big={fmt(s.botUsers)} note="Telegram chats that asked the bot for yields, a trove or the premium bundle (an approximate count, no chat ids kept)." since={s.since} />
        </ul>
      </section>
      <section aria-labelledby="x402-h" className="space-y-3">
        <h2 id="x402-h" className="text-base font-bold">x402 payments</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(["testnet", "mainnet"] as const).map((k) => (
            <Tile
              key={k}
              title={`Mezo ${k}`}
              big={fmt(net(k).payers)}
              note={`${net(k).payers === 1 ? "payer" : "payers"} outside the team, ${fmt(net(k).payments)} ${net(k).payments === 1 ? "payment" : "payments"} from them. Payments from our own wallets, counted separately: ${fmt(net(k).own)}.`}
              since={s.since}
            />
          ))}
        </ul>
      </section>
      <section aria-labelledby="hosts-h" className={CARD}>
        <h2 id="hosts-h" className="text-base font-bold">Sites using the widget</h2>
        <p className="mt-1 text-xs text-ink-muted">Sites that loaded the widget, as reported by the embedding page. Our own pages are left out.</p>
        {outside ? (
          <ul className="mt-3 space-y-1 text-sm">
            {s.embedHosts.map((h) => (
              <li key={h.host} className="flex justify-between gap-3">
                <span className="min-w-0 break-all">{h.host}</span>
                <span className="text-ink-muted">{fmt(h.count)} loads</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm">None yet.</p>
        )}
      </section>
    </>
  );
}

export default function StatsPage() {
  return (
    <>
      <SiteHeader current="/stats" />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
        <div>
          <h1 className="text-[30px] leading-tight font-extrabold tracking-tight md:text-[40px]">Usage <span className="hl">stats</span></h1>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            Plain counts, kept without addresses or chat ids. Requests include site visitors, bot users and outside apps. Our own cron and warm-up calls are excluded.
          </p>
        </div>
        <Suspense
          fallback={
            <div className="space-y-3" aria-busy="true">
              <p role="status" className="text-sm">Loading counts…</p>
              <div aria-hidden="true" className="h-32 animate-pulse rounded-[20px] bg-surface" />
            </div>
          }
        >
          <Live />
        </Suspense>
      </main>
    </>
  );
}
