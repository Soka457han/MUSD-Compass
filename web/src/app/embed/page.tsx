import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowUpRightIcon, CompassMark, LockIcon } from "@/components/Icons";
import { musd, pct } from "@/lib/format";
import { loadSources } from "@/lib/sources";
import { buildYields, parseQuery } from "@/lib/yields";

export const metadata: Metadata = { title: "MUSD Compass widget", robots: { index: false } };

/** Compact top-3 by cash carry for iframes on other sites (loaded by /embed.js). */
async function TopThree({ searchParams }: { searchParams: PageProps<"/embed">["searchParams"] }) {
  await connection();
  const sp = new URLSearchParams();
  const amount = (await searchParams).amount;
  if (typeof amount === "string") sp.set("amount", amount);
  const parsed = parseQuery(sp);
  const q = parsed.ok ? parsed.query : { amount: 2000, mode: "holder" as const, trove: "new" as const, days: 90 as const, ratePct: null };
  const { venues } = buildYields(await loadSources(), q);
  const top = venues.filter((v) => v.status === "ok" && v.carry.cash !== null).slice(0, 3);
  const full = `/?amount=${q.amount}&mode=holder&days=${q.days}`;
  return (
    <>
      <p className="text-sm font-semibold">Cash carry per year on {musd(q.amount)}</p>
      <ol className="mt-2 divide-y divide-line border-y border-line">
        {top.map((v) => (
          <li key={v.id} className="flex items-baseline gap-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{v.name}</span>
            {v.carry.locked ? (
              <span className="flex shrink-0 items-center gap-1 text-xs text-ink-muted">
                <LockIcon className="size-3.5" title="with locked veMEZO" />
                {pct(v.carry.total)}
              </span>
            ) : null}
            <span className="price shrink-0 text-2xl">{pct(v.carry.cash)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-ink-muted">
        Mainnet data · assumes {q.days}-day hold · <LockIcon className="inline size-3 align-[-0.1em]" /> with locked veMEZO, not cash
      </p>
      <a href={full} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold underline">
        Full table on MUSD Compass
        <ArrowUpRightIcon className="size-4" title="(opens in a new tab)" />
      </a>
    </>
  );
}

export default function EmbedPage(props: PageProps<"/embed">) {
  return (
    <main className="w-full max-w-md flex-1 bg-card p-3 text-ink">
      <h1 className="flex items-center gap-1.5 text-base font-extrabold">
        <CompassMark className="size-4" />
        MUSD Compass
      </h1>
      <Suspense fallback={<p className="mt-2 text-sm">Reading Mezo and Ethereum…</p>}>
        <TopThree searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
