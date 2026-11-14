"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { musd, pct, shortDate, timeUtc, usd } from "@/lib/format";
import { minNewTroveAmount } from "@/lib/carry/carry";
import { buildYields, cleanAmount, parseQuery, parseQueryLenient, type Query, type Sources, type VenueOut } from "@/lib/yields";
import { LockIcon } from "./Icons";
import { SiteFooter } from "./Landing";
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
      <legend className="mb-2 pl-[21px] text-[13px] font-semibold text-ink-muted">{props.legend}</legend>
      <div className="seg grid auto-cols-fr grid-flow-col gap-0.5 rounded-full border border-line bg-card p-1" style={{ "--n": props.options.length } as React.CSSProperties}>
        {props.options.map((o) => (
          <label
            key={o.value}
            className="relative flex h-11 cursor-pointer items-center justify-center rounded-full px-3.5 text-[15px] font-semibold whitespace-nowrap transition-colors duration-150 has-[:checked]:text-on-accent has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]"
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

/** Decoration only: a coin circling a glass ring, behind the best-cash card on wide screens. */
function HeroRing() {
  return (
    <svg aria-hidden="true" viewBox="0 0 340 340" className="pointer-events-none absolute -top-6 right-0 -z-10 hidden size-[420px] lg:block xl:-right-12">
      <circle cx="170" cy="170" r="120" fill="none" stroke="var(--ring)" strokeWidth="30" />
      <circle cx="170" cy="170" r="120" fill="none" stroke="var(--accent)" strokeOpacity="0.35" strokeWidth="2" />
      {/* 44 x 46 keeps the picture's shape; its centre sits on the ring line (radius 120 from 170,170). */}
      <g className="hero-coin">
        <image href="/coin.webp" x="148" y="27" width="44" height="46" />
      </g>
    </svg>
  );
}

const vt = (id: string) => `v-${id.replace(/[^a-z0-9-]/gi, "-")}`;

const FIELD = "block h-[54px] w-full rounded-full border border-field bg-card px-5 text-ink";

function SizeOnly({ venues }: { venues: VenueOut[] }) {
  return (
    <section aria-labelledby="size-only" className="mt-8">
      <h2 id="size-only" className="text-[15px] font-bold">
        Not ranked: no steady APR
      </h2>
      <p className="mt-1 max-w-prose text-[13px] text-ink-muted">
        The Stability Pool earns only on liquidations; the Ditto vault earns on Ethereum, where Compass cannot read its rate. Size is live.
      </p>
      <ul className="mt-3 overflow-hidden rounded-2xl border border-line">
        {venues.map((v, i) => (
          <li key={v.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 ${i ? "border-t border-line" : ""}`}>
            <span className="min-w-0 flex-1 text-sm font-semibold">
              {v.name} <span className="text-xs font-normal text-ink-muted">· {v.chain}</span>
            </span>
            <span className="text-sm">
              <span className="text-ink-muted">Size </span>
              <span className="font-semibold">{v.status === "unavailable" ? "n/a" : usd(v.tvlUsd)}</span>
            </span>
            <span className="w-full text-xs text-ink-muted">
              {v.status === "unavailable" ? "Source unavailable right now" : `${v.tags.join(" · ")} · as of ${timeUtc(v.updatedAt)}`} ·{" "}
              <a href={v.action.url} target="_blank" rel="noreferrer" className="inline-block py-3 -my-3 font-semibold text-accent-text underline">
                {v.action.label}
              </a>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PegLine({ peg }: { peg: NonNullable<Sources["peg"]> }) {
  return (
    <p className="text-sm text-ink-muted">
      MUSD trades at ${peg.priceUsd.toFixed(4)} on Mezo&apos;s MUSD/mUSDC pool (mUSDC counted as $1) · redemption floor ${peg.floorUsd.toFixed(4)} (1 minus the {peg.redemptionPct}% redemption fee) · as of {timeUtc(peg.updatedAt)}
      {peg.depthMusd != null && ` · ${peg.depthMusd < 1000 ? "under 1,000" : `about ${(Math.round(peg.depthMusd / 1000) * 1000).toLocaleString("en-US")}`} MUSD can be sold on this pool before MUSD falls below $${peg.depthFloorUsd.toFixed(2)}`}
      {peg.priceUsd < peg.floorUsd && " · below the floor: a redemption returns more than this price, before gas and slippage"}
    </p>
  );
}

/** The answer, up top: the best cash carry for the current inputs. The full card for it leads the ranked list below. */
function BestCash({ v, holding, mint, className = "" }: { v: VenueOut; holding: string; mint: { amount: number; rate: number } | null; className?: string }) {
  const external = v.action.url.startsWith("http");
  const locked = v.carry.locked ?? 0;
  const cash = v.carry.cash ?? 0;
  return (
    <section aria-labelledby="best-h" className={`flex flex-col gap-3.5 rounded-[20px] border border-line bg-card p-[22px] md:p-8 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="best-h" className="text-base font-bold md:text-lg">
          {v.name}
        </h2>
        <span className="shrink-0 rounded-full bg-tile-yellow px-3 py-1 text-xs font-bold text-tile-ink md:text-[13px]">#1 best cash</span>
      </div>
      <p className="price text-[64px] md:text-[96px]">
        {pct(v.carry.cash)}
        <span className="sr-only"> cash carry per year</span>
      </p>
      <p className="text-ink-muted">
        cash a year after costs · {holding.toLowerCase()} · {v.chain} · {usd(v.tvlUsd)} size
      </p>
      {mint && (
        <p data-testid="mint-line" className="rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold md:text-base">
          {cash > 0
            ? `Borrow ${musd(mint.amount)} against your BTC at ${mint.rate}%: ${v.name} pays ${pct(v.carry.liquid)}. After the fee and interest you keep ${pct(cash)} a year, about ${musd(Math.round((mint.amount * cash) / 100))}.`
            : `Borrow ${musd(mint.amount)} against your BTC at ${mint.rate}%: after the fee and interest the best place pays ${pct(cash)}. Borrowing to earn does not pay today.`}
        </p>
      )}
      {locked > 0 && (
        <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-locked px-3 py-1 text-[13px] font-bold text-on-locked">
          <LockIcon className="size-4" />+{pct(locked)} locked veMEZO, not counted
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-2.5">
        <a
          href={v.action.url}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-accent px-6 font-bold text-on-accent no-underline md:flex-none"
        >
          {v.action.label}
        </a>
        <a href="#venues" className="hidden h-12 items-center rounded-full border border-line px-[22px] font-semibold no-underline md:inline-flex">
          How it&apos;s worked out
        </a>
      </div>
    </section>
  );
}

export function Compass({ sources, between, after }: { sources: Sources; between?: ReactNode; after?: ReactNode }) {
  const [form, setForm] = useState<Form>({ amount: "2000", mode: "holder", days: "90", rate: "", trove: "new" });
  const [hydrated, setHydrated] = useState(false);
  // The last amount that parsed: an invalid one keeps this ranking on screen instead of collapsing the page.
  const [goodAmount, setGoodAmount] = useState("2000");
  // Latest form, so a quick edit during a view transition never builds on a stale render.
  const latest = useRef(form);

  // Deep links (the bot sends ?amount=…&mode=…): read once after hydration, then mirror edits into the URL.
  useEffect(() => {
    // A bad field (e.g. ?rate=9 or ?amount=0) falls back to its default; the link's other fields still apply.
    const q = parseQueryLenient(new URLSearchParams(window.location.search));
    const fromUrl: Form = { amount: String(q.amount), mode: q.mode, days: String(q.days) as Form["days"], rate: q.ratePct ? String(q.ratePct) : "", trove: q.trove };
    latest.current = fromUrl;
    setForm(fromUrl); // eslint-disable-line react-hooks/set-state-in-effect
    setGoodAmount(fromUrl.amount);
    setHydrated(true);
  }, []);

  // Choice changes re-rank with a view transition (the page's one motion moment); typing never animates.
  const update = (patch: Partial<Form>, animate = true) => {
    const next = { ...latest.current, ...patch };
    if (patch.amount && parseQuery(new URLSearchParams({ amount: patch.amount })).ok) setGoodAmount(patch.amount);
    latest.current = next;
    window.history.replaceState(null, "", `?${toParams(next)}`);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate && !reduce && typeof document.startViewTransition === "function") {
      document.startViewTransition(() => flushSync(() => setForm(latest.current))); // apply the newest state when the transition runs
    } else {
      setForm(next);
    }
  };

  const parsed = parseQuery(toParams({ ...form, amount: form.amount || "0" })); // an empty box is an error here, not the API's 2,000 default
  const shown = parsed.ok ? parsed : parseQuery(toParams({ ...form, amount: goodAmount }));
  const query: Query | null = shown.ok ? shown.query : null;
  const dim = parsed.ok ? "" : "grayscale"; // marks the ranking as for the previous amount; keeps text contrast, unlike opacity
  const result = useMemo(() => (query ? buildYields(sources, query) : null), [sources, query?.amount, query?.mode, query?.days, query?.ratePct, query?.trove]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveRate = sources.borrow.ratePct;
  // Venues with a cash figure are ranked as labels; size-only venues (no steady APR) sit in a compact list below.
  const ranked = result?.venues.filter((v) => v.carry.cash !== null && !v.pairToken) ?? [];
  const paired = result?.venues.filter((v) => v.carry.cash !== null && v.pairToken) ?? [];
  const sizeOnly = result?.venues.filter((v) => v.carry.cash === null) ?? [];
  const [lead, ...rest] = ranked;
  const days = query?.days ?? 90;

  const byId = (id: string) => result?.venues.find((v) => v.id === id);
  const vault = byId("mezo-smusd");
  const stability = byId("mezo-stability-pool");
  const isDown = (id: string) => byId(id)?.status === "unavailable"; // a down source would otherwise count as 0 pools
  const tiles = result
    ? [
        { label: "Savings Vault", value: pct(vault?.carry.cash ?? null), href: "/vault", bg: "bg-tile-yellow" },
        { label: "Ethereum pools", value: isDown("merkl") ? "Unavailable" : String(result.venues.filter((v) => v.chain === "Ethereum" && v.status === "ok").length), href: "#venues", bg: "bg-tile-pink" },
        { label: "Mezo pools", value: isDown("mezo-pools") ? "Unavailable" : String(result.venues.filter((v) => v.id.startsWith("mezo-pool-") && v.status === "ok").length), href: "#venues", bg: "bg-tile-lilac" },
        { label: "Stability Pool", value: usd(stability?.tvlUsd ?? null), href: "#size-only", bg: "bg-tile-peach" },
        { label: "My MUSD", value: "Check", href: "/my", bg: "bg-tile-blue" },
        { label: "My trove", value: "Plan", href: "/trove", bg: "bg-tile-mint" },
      ]
    : [];

  return (
    <>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 md:px-6 md:pt-14">
        <section aria-label="Calculator" className="relative isolate grid gap-7 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-12">
          <HeroRing />
          <div className="flex min-w-0 flex-col gap-4 md:gap-5">
            <h1 className="text-[30px] leading-[1.15] font-extrabold tracking-tight text-balance md:text-[56px] md:leading-[1.06]">Where your MUSD earns most, after costs.</h1>
            <p className="text-ink-muted md:max-w-[520px] md:text-lg">Every Mezo earning spot, ranked by the cash you keep. Live from Mezo and Ethereum.</p>
            <form
              data-hydrated={hydrated || undefined}
              className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-surface p-4 md:mt-2 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-end xl:gap-3.5 xl:border-0 xl:bg-transparent xl:p-0"
              onSubmit={(e) => e.preventDefault()}
            >
              <div className="min-w-0">
                <label htmlFor="amount" className="mb-2 block pl-[21px] text-[13px] font-semibold text-ink-muted">
                  Amount (MUSD)
                </label>
                <input
                  id="amount"
                  inputMode="decimal"
                  autoComplete="off"
                  value={form.amount}
                  onChange={(e) => update({ amount: cleanAmount(e.target.value) }, false)}
                  aria-invalid={!parsed.ok}
                  aria-describedby={!parsed.ok ? "amount-error" : undefined}
                  className={`${FIELD} text-xl font-bold`}
                />
              </div>
              <Segmented legend="I want to" name="mode" value={form.mode} onChange={(mode) => update({ mode })} options={[{ value: "holder", label: "Hold" }, { value: "borrower", label: "Borrow" }]} />
              <Segmented legend="Hold for (days)" name="days" value={form.days} onChange={(days) => update({ days })} options={[{ value: "30", label: "30" }, { value: "90", label: "90" }, { value: "365", label: "365" }]} />
              {form.mode === "borrower" ? (
                <>
                  <div className="min-w-0">
                    <label htmlFor="rate" className="mb-2 block pl-[21px] text-[13px] font-semibold text-ink-muted">
                      Borrow rate
                    </label>
                    <select id="rate" value={form.rate} onChange={(e) => update({ rate: e.target.value })} className={`${FIELD} text-[15px] font-semibold`}>
                      <option value="">Live rate ({liveRate}%)</option>
                      {[1, 2, 3, 4, 5].map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </select>
                  </div>
                  <Segmented legend="Trove" name="trove" value={form.trove} onChange={(trove) => update({ trove })} options={[{ value: "new", label: "New" }, { value: "existing", label: "Mine" }]} />
                  {form.trove === "existing" && (
                    <p className="text-sm xl:col-span-3">
                      <Link href="/trove" className="font-semibold text-accent-text underline">
                        Read your trove&apos;s rate and safe extra borrow
                      </Link>
                    </p>
                  )}
                </>
              ) : null}
              {!parsed.ok && (
                <p id="amount-error" role="alert" className="text-sm font-semibold text-danger-text xl:col-span-3">
                  {parsed.error}
                  {query && ` Results shown are still for ${musd(query.amount)}.`}
                </p>
              )}
              {result?.notice && (
                <p role="status" className="rounded-2xl bg-tile-yellow px-4 py-2.5 text-sm font-semibold text-tile-ink xl:col-span-3">
                  {result.notice}
                </p>
              )}
            </form>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {form.mode === "holder" && (
                <button
                  type="button"
                  onClick={() => update({ mode: "borrower", trove: "new", amount: String(Math.max(Number(form.amount) || 0, Math.ceil(minNewTroveAmount(sources.borrow)))) })}
                  className="inline-flex min-h-11 items-center rounded-full bg-tile-lilac px-5 text-sm font-bold text-tile-ink md:text-[15px]"
                >
                  Have BTC? See if borrowing MUSD pays
                </button>
              )}
              <Link href="/my" prefetch={false} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline md:text-[15px]">
                Already hold MUSD? See where it sits
              </Link>
            </div>
          </div>
          {result && lead ? (
            <BestCash v={lead} holding={result.assumptions.holding} mint={query?.mode === "borrower" ? { amount: query.amount, rate: result.assumptions.ratePct } : null} className={`${dim} lg:mt-36 lg:mr-10 xl:mr-12`} />
          ) : (
            <p className="text-sm">No venue can be ranked right now.</p>
          )}
          {result?.assumptions.peg && <PegLine peg={result.assumptions.peg} />}
        </section>

        <div className="mt-14 flex flex-col gap-14 md:mt-24 md:gap-20">
          {result && lead && (
            <>
              <section aria-labelledby="browse-h" className={dim || undefined}>
                <h2 id="browse-h" className="text-2xl leading-tight font-extrabold tracking-tight md:text-[32px]">
                  Browse by type
                </h2>
                <ul className="mt-4 grid grid-cols-2 gap-2.5 md:mt-5 md:grid-cols-6 md:gap-3">
                  {tiles.map((t) => (
                    <li key={t.label}>
                      <a href={t.href} className={`flex h-[72px] items-center justify-between gap-2 rounded-[14px] px-4 font-bold text-tile-ink no-underline md:h-28 md:flex-col md:items-start md:justify-between md:rounded-2xl md:p-[18px] ${t.bg}`}>
                        <span className="text-sm md:text-[15px]">{t.label}</span>
                        <span className="text-[15px] font-extrabold md:text-[22px]">{t.value}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="venues" className={dim || undefined}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 id="venues" className="scroll-mt-6 text-2xl leading-tight font-extrabold tracking-tight md:text-[32px]">
                    All venues
                  </h2>
                  <p className="text-sm text-ink-muted">{result.assumptions.holding} · locked veMEZO shown beside cash, never added to it</p>
                </div>
                <ol aria-label="Venues ranked by cash carry" className="mt-4 grid gap-3 md:mt-5 md:grid-cols-2 md:gap-4">
                  <li className="md:col-span-2" style={{ viewTransitionName: vt(lead.id) }}>
                    <PriceLabel v={lead} days={days} amount={query?.amount ?? 0} lead />
                  </li>
                  {rest.map((v) => (
                    <li key={v.id} style={{ viewTransitionName: vt(v.id) }}>
                      <PriceLabel v={v} days={days} amount={query?.amount ?? 0} />
                    </li>
                  ))}
                </ol>
                {paired.length > 0 && (
                  <section aria-labelledby="paired" className="mt-8">
                    <h2 id="paired" className="text-[15px] font-bold">
                      Also needs BTC or MEZO
                    </h2>
                    <p className="mt-1 max-w-prose text-[13px] text-ink-muted">
                      These pools take MUSD plus an equal value of BTC or MEZO, so you carry that token&apos;s price. Their rate is not compared with the MUSD-only spots above.
                    </p>
                    <ul aria-label="Pools that also need BTC or MEZO" className="mt-3 grid gap-3 md:grid-cols-2 md:gap-4">
                      {paired.map((v) => (
                        <li key={v.id}>
                          <PriceLabel v={v} days={days} amount={query?.amount ?? 0} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {sizeOnly.length > 0 && <SizeOnly venues={sizeOnly} />}
              </section>
            </>
          )}

          {between}

          {after}
        </div>
      </main>

      <SiteFooter
        notes={
          <>
            <p>
              <span className="font-semibold text-ink">Mainnet data</span> (Mezo + Ethereum), kept for 5 min then refreshed in the background · data as of {result?.updatedAt ? `${shortDate(result.updatedAt)}, ${timeUtc(result.updatedAt)}` : "unknown"}. Vault actions run on{" "}
              <span className="font-semibold text-ink">Mezo testnet</span>.
            </p>
            <p>
              Cash carry ranks. Locked rewards are veMEZO: claimed on Mezo, locked 12 weeks, valued at MEZO spot{sources.mezoPriceUsd ? ` ($${sources.mezoPriceUsd.toFixed(5)}${sources.mezoPriceSource ? `, from ${sources.mezoPriceSource === "Merkl" ? "Merkl" : "the Mezo MEZO/MUSD pool"}` : ""})` : ""}, shown on the pink tag and never in the cash figure.{" "}
              <Link href="/rewards" className="font-semibold text-accent-text underline">
                Check an address for unclaimed veMEZO
              </Link>
              .
            </p>
            {sources.ethRoundTrip && (
              <p>
                Ethereum costs: ≈ ${sources.ethRoundTrip.usd.toFixed(2)} per round trip, {sources.ethRoundTrip.basis}.
              </p>
            )}
          </>
        }
      />
    </>
  );
}
