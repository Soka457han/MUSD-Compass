"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { timeUtc, usd } from "@/lib/format";
import { buildYields, parseQuery, type Query, type Sources, type VenueOut } from "@/lib/yields";
import { PriceLabel } from "./PriceLabel";

type Form = { amount: string; mode: "holder" | "borrower"; days: "30" | "90" | "365"; rate: string; trove: "new" | "existing" };

function toParams(f: Form): URLSearchParams {
  const p = new URLSearchParams({ amount: f.amount, mode: f.mode, days: f.days });
  if (f.mode === "borrower") {
    p.set("trove", f.trove);
    if (f.rate) p.set("rate", f.rate);
  }
  return p;
}

function Segmented<T extends string>(props: { legend: string; name: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-semibold">{props.legend}</legend>
      <div className="flex rounded-sm border-2 border-ink bg-label">
        {props.options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-11 flex-1 cursor-pointer items-center justify-center px-2 text-sm font-semibold transition-colors duration-150 has-[:checked]:bg-ink has-[:checked]:text-label has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]"
          >
            <input
              type="radio"
              name={props.name}
              value={o.value}
              checked={props.value === o.value}
              onChange={() => props.onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const vt = (id: string) => `v-${id.replace(/[^a-z0-9-]/gi, "-")}`;

function SizeOnly({ venues }: { venues: VenueOut[] }) {
  return (
    <section aria-labelledby="size-only" className="mt-8">
      <h2 id="size-only" className="text-sm font-bold" style={{ fontStretch: "90%" }}>
        Not ranked: no steady APR
      </h2>
      <p className="mt-1 max-w-prose text-xs text-ink-muted">
        Mezo pools show their APR in the Mezo app; the Stability Pool earns only on liquidations. Size is live.
      </p>
      <ul className="mt-3 divide-y divide-line border-y-2 border-ink bg-label">
        {venues.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
            <span className="min-w-0 flex-1 text-sm font-semibold">
              {v.name} <span className="text-xs font-normal text-ink-muted">· {v.chain}</span>
            </span>
            <span className="text-sm">
              <span className="text-ink-muted">Size </span>
              <span className="font-semibold">{v.status === "unavailable" ? "n/a" : usd(v.tvlUsd)}</span>
            </span>
            <span className="w-full text-xs text-ink-muted">
              {v.status === "unavailable" ? "Source unavailable right now" : v.tags.join(" · ")} ·{" "}
              <a href={v.action.url} target="_blank" rel="noreferrer" className="font-semibold text-ink underline">
                {v.action.label}
              </a>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Compass({ sources }: { sources: Sources }) {
  const [form, setForm] = useState<Form>({ amount: "2000", mode: "holder", days: "90", rate: "", trove: "new" });
  const [hydrated, setHydrated] = useState(false);
  // Latest form, so a quick edit during a view transition never builds on a stale render.
  const latest = useRef(form);

  // Deep links (the bot sends ?amount=…&mode=…): read once after hydration, then mirror edits into the URL.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const r = parseQuery(sp);
    if (!r.ok) {
      setHydrated(true); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const q = r.query;
    const fromUrl: Form = { amount: String(q.amount), mode: q.mode, days: String(q.days) as Form["days"], rate: q.ratePct ? String(q.ratePct) : "", trove: q.trove };
    latest.current = fromUrl;
    setForm(fromUrl);
    setHydrated(true);
  }, []);

  // Choice changes re-rank with a view transition (the page's one motion moment); typing never animates.
  const update = (patch: Partial<Form>, animate = true) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    window.history.replaceState(null, "", `?${toParams(next)}`);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate && !reduce && typeof document.startViewTransition === "function") {
      document.startViewTransition(() => flushSync(() => setForm(latest.current))); // apply the newest state when the transition runs
    } else {
      setForm(next);
    }
  };

  const parsed = parseQuery(toParams(form));
  const query: Query | null = parsed.ok ? parsed.query : null;
  const result = useMemo(() => (query ? buildYields(sources, query) : null), [sources, query?.amount, query?.mode, query?.days, query?.ratePct, query?.trove]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveRate = sources.borrow.ratePct;
  // Venues with a cash figure are ranked as labels; size-only venues (no steady APR) sit in a compact list below.
  const ranked = result?.venues.filter((v) => v.carry.cash !== null) ?? [];
  const sizeOnly = result?.venues.filter((v) => v.carry.cash === null) ?? [];
  const [lead, ...rest] = ranked;
  const days = query?.days ?? 90;

  return (
    <>
      <section aria-label="Calculator" className="border-b-2 border-ink bg-label">
        <form data-hydrated={hydrated || undefined} className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="amount" className="mb-1 block text-xs font-semibold">
              Amount (MUSD)
            </label>
            <input
              id="amount"
              inputMode="decimal"
              autoComplete="off"
              value={form.amount}
              onChange={(e) => update({ amount: e.target.value.replace(/[^\d.]/g, "") }, false)}
              aria-invalid={!parsed.ok}
              aria-describedby={!parsed.ok ? "amount-error" : undefined}
              className="price block h-11 w-full rounded-sm border-2 border-ink bg-label px-2 text-2xl"
            />
          </div>
          <div>
            <Segmented legend="I want to" name="mode" value={form.mode} onChange={(mode) => update({ mode })} options={[{ value: "holder", label: "Hold" }, { value: "borrower", label: "Borrow" }]} />
          </div>
          <div>
            <Segmented legend="Hold for (days)" name="days" value={form.days} onChange={(days) => update({ days })} options={[{ value: "30", label: "30" }, { value: "90", label: "90" }, { value: "365", label: "365" }]} />
          </div>
          {form.mode === "borrower" ? (
            <>
              <div>
                <label htmlFor="rate" className="mb-1 block text-xs font-semibold">
                  Borrow rate
                </label>
                <select id="rate" value={form.rate} onChange={(e) => update({ rate: e.target.value })} className="block h-11 w-full rounded-sm border-2 border-ink bg-label px-2 text-sm font-semibold">
                  <option value="">Live rate ({liveRate}%)</option>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Segmented legend="Trove" name="trove" value={form.trove} onChange={(trove) => update({ trove })} options={[{ value: "new", label: "New" }, { value: "existing", label: "Mine" }]} />
              </div>
              {form.trove === "existing" && (
                <p className="col-span-2 text-sm sm:col-span-4">
                  <Link href="/trove" className="font-semibold underline">
                    Read your trove&apos;s rate and safe extra borrow
                  </Link>
                </p>
              )}
            </>
          ) : null}
          {!parsed.ok && (
            <p id="amount-error" role="alert" className="col-span-2 text-sm font-semibold text-danger-text sm:col-span-4">
              {parsed.error}
            </p>
          )}
          {result?.notice && (
            <p role="status" className="col-span-2 border-2 border-ink bg-yellow px-2 py-1.5 text-sm font-semibold text-on-yellow sm:col-span-4">
              {result.notice}
            </p>
          )}
        </form>
      </section>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-5">
        <h1 className="sr-only">Where MUSD earns the most after costs</h1>
        {result && lead ? (
          <>
            <h2 className="mb-2 text-sm font-bold" style={{ fontStretch: "90%" }}>
              Best cash right now · {result.assumptions.holding.toLowerCase()}
            </h2>
            <ol aria-label="Venues ranked by cash carry" className="grid gap-4 md:grid-cols-2">
              <li className="md:col-span-2 md:max-w-3xl" style={{ viewTransitionName: vt(lead.id) }}>
                <PriceLabel v={lead} days={days} lead />
              </li>
              {rest.map((v) => (
                <li key={v.id} style={{ viewTransitionName: vt(v.id) }}>
                  <PriceLabel v={v} days={days} />
                </li>
              ))}
            </ol>
            {sizeOnly.length > 0 && <SizeOnly venues={sizeOnly} />}
          </>
        ) : (
          <p className="text-sm">Enter an amount to rank venues.</p>
        )}
      </main>

      <footer className="border-t-2 border-ink bg-label">
        <div className="mx-auto max-w-5xl space-y-1.5 px-4 py-4 text-xs leading-relaxed">
          <p>
            <span className="font-semibold">Mainnet data</span> (Mezo + Ethereum), refreshed every 5 min · data as of {timeUtc(sources.venues[0]?.updatedAt ?? new Date().toISOString())}. Vault actions run on{" "}
            <span className="font-semibold">Mezo testnet</span>.
          </p>
          <p>
            Cash carry ranks. Locked rewards are veMEZO: claimed on Mezo, locked 12 weeks, valued at MEZO spot{sources.mezoPriceUsd ? ` ($${sources.mezoPriceUsd.toFixed(5)})` : ""} — shown on the red sticker, never in the price.{" "}
            <Link href="/rewards" className="font-semibold underline">
              Check an address for unclaimed veMEZO
            </Link>
            .
          </p>
          {sources.ethRoundTrip && (
            <p>
              Ethereum costs: ≈ ${sources.ethRoundTrip.usd.toFixed(2)} per round trip — {sources.ethRoundTrip.basis}.
            </p>
          )}
          <p>Not financial advice. Independent community tool, not made by Mezo.</p>
        </div>
      </footer>
    </>
  );
}
