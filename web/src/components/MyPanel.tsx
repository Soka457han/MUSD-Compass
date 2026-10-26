"use client";

import Link from "next/link";
import { useState } from "react";
import { SAMPLES } from "@/lib/chain/addresses";
import { musd, pct, usd } from "@/lib/format";
import { compare, placesFor, type Positions, type Row } from "@/lib/positions";
import type { Sources, VenueOut } from "@/lib/yields";
import { ArrowUpRightIcon } from "./Icons";

const ve = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const MEZO_VAULTS = "https://mezo.org/earn/vaults"; // mainnet Savings Vault in the Mezo app (the /vault page here is testnet)

/** What the holding earns now, in words. */
function nowText(r: Row, vaultApr: number | null): string {
  if (r.id === "wallet") return "Earns nothing while it sits in the wallet.";
  if (r.id === "stability") return "No steady APR: earns only when troves are liquidated.";
  if (r.id === "staked")
    return r.nowPct === null
      ? "Earns MEZO from the gauge instead of the savings yield (rate unavailable right now)."
      : `Earns about ${pct(r.nowPct)} a year, paid in MEZO. Staking hands the ${pct(vaultApr)} savings yield to voters.`;
  return `Earns ${pct(r.nowPct)} cash a year now.`;
}

/** Where to act on mainnet: the vault lives in the Mezo app; other venues keep their own link. */
function actionFor(r: Row, benchmarkId: string) {
  if (r.best.id !== benchmarkId) return r.best.action;
  return { label: r.id === "staked" ? "Unstake in the Mezo app" : "Deposit in the Mezo app", url: MEZO_VAULTS };
}

/** Every place this MUSD could go: ranked by cash, then the pools that also need BTC or MEZO. */
function Places({ amount, sources }: { amount: number; sources: Sources }) {
  const all = placesFor(amount, sources);
  const ranked = all.filter((v) => v.carry.cash !== null);
  const paired = all.filter((v) => v.carry.cash === null && v.tags.some((t) => t.startsWith("Mezo chain:")));
  const link = (v: VenueOut) => (v.id === sources.benchmarkId ? { label: "Mezo app", url: MEZO_VAULTS } : { label: v.chain === "Mezo" ? "Mezo app" : "Open", url: v.action.url });
  return (
    <section aria-labelledby="places-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
      <h2 id="places-h" className="text-base font-bold">
        Every place {musd(amount)} could go today
      </h2>
      <p className="mt-1 text-sm text-ink-muted">Best cash first, after costs, holding 90 days. Locked veMEZO is shown beside cash and never added to it.</p>
      <ol className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
        {ranked.map((v, i) => {
          const l = link(v);
          const locked = v.carry.locked ?? 0;
          const mezoPaid = v.tags.find((t) => t.startsWith("Paid in MEZO"));
          return (
            <li key={v.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
              <span className="w-5 shrink-0 text-sm font-bold text-ink-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 text-sm font-semibold">
                {v.name} <span className="text-xs font-normal text-ink-muted">· {v.chain}</span>
              </span>
              <span className="text-sm font-extrabold">{pct(v.carry.cash)} cash</span>
              <span className="w-full pl-8 text-xs text-ink-muted">
                about {musd(Math.max(0, Math.floor((amount * (v.carry.cash ?? 0)) / 100)))} a year
                {locked > 0 && ` · +${pct(locked)} locked veMEZO, not counted`}
                {mezoPaid && ` · ${mezoPaid.toLowerCase()}`} ·{" "}
                <a href={l.url} target="_blank" rel="noreferrer" className="font-semibold text-accent-text underline">
                  {l.label}
                </a>
              </span>
            </li>
          );
        })}
      </ol>
      {paired.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-bold">Higher rates, but they need BTC or MEZO too</h3>
          <ul className="mt-2 space-y-1.5 text-xs text-ink-muted">
            {paired.map((v) => (
              <li key={v.id}>
                <span className="font-semibold text-ink">{v.name}</span>: {v.tags.find((t) => t.startsWith("Mezo chain:"))!.replace("Mezo chain: ", "")} · {v.tags.filter((t) => t.endsWith("price exposure")).join(", ")}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function MyPanel({ sources }: { sources: Sources }) {
  const [lookup, setLookup] = useState("");
  const [data, setData] = useState<Positions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (addr: string) => {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/positions/${encodeURIComponent(addr)}`);
      const j = await r.json();
      if (!r.ok) {
        setData(null);
        setError(j.error ?? "Could not read this address.");
      } else setData(j);
    } catch {
      setError("Could not reach Compass — check your connection.");
    } finally {
      setBusy(false);
    }
  };

  const rows = data ? compare(data, sources) : [];
  const vaultApr = sources.venues.find((v) => v.id === sources.benchmarkId && v.status === "ok")?.rates.liquidApr ?? null;
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const nothing = data && rows.length === 0 && !data.trove && !(data.veMezo && data.veMezo.unclaimed > 0);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
      <section aria-labelledby="my-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
        <h2 id="my-h" className="text-base font-bold">
          Where your MUSD sits, and where it would earn more
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">Wallet, Savings Vault (staked or not), Stability Pool, trove and unclaimed veMEZO on Mezo mainnet. Read only: paste any public address.</p>
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(lookup.trim());
          }}
        >
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <label htmlFor="my-address" className="mb-1 block text-xs font-semibold">
              Address
            </label>
            <input id="my-address" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} className="block h-11 w-full rounded-full border border-field bg-card px-4 text-sm" />
          </div>
          <button type="submit" disabled={busy} className="min-h-11 rounded-full border border-line px-4 text-sm font-bold disabled:opacity-60">
            Look up
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setLookup(SAMPLES.positions);
              load(SAMPLES.positions);
            }}
            className="min-h-11 px-2 text-sm font-semibold underline"
          >
            Try a sample
          </button>
        </form>
        {busy && <p className="mt-2 text-sm">Reading Mezo mainnet…</p>}
        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger-text">
            {error}
          </p>
        )}
        {data && rows.length > 0 && (
          <p className="mt-4 text-sm text-ink-muted">
            <span className="price block text-[2.5rem] text-ink">{musd(total)}</span>
            on Mezo, in the wallet or put to work
          </p>
        )}
        {nothing && <p className="mt-4 text-sm">No MUSD, trove or unclaimed veMEZO for this address on Mezo mainnet.</p>}
      </section>

      {data && rows.length > 0 && (
        <section aria-labelledby="holdings-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
          <h2 id="holdings-h" className="text-base font-bold">
            Each holding against the best cash place today
          </h2>
          <ul className="mt-3 space-y-3">
            {rows.map((r) => {
              const there = r.extraPerYear !== null && r.extraPerYear < 1;
              const act = actionFor(r, sources.benchmarkId);
              const external = act.url.startsWith("http");
              const bestName = r.id === "staked" && r.best.id === sources.benchmarkId ? `${r.best.name}, unstaked` : r.best.name;
              return (
                <li key={r.id} className="rounded-2xl border border-line px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="text-sm font-bold">{r.label}</h3>
                    <span className="text-base font-extrabold">{musd(r.amount)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {nowText(r, vaultApr)}{" "}
                    {there ? (
                      <span className="font-semibold text-ink">This is the best cash place today.</span>
                    ) : (
                      <>
                        Best now: <span className="font-semibold text-ink">{bestName}</span> at {pct(r.best.carry.cash)}
                        {r.extraPerYear !== null && r.extraPerYear >= 1 && (
                          <>
                            , about <span className="font-semibold text-ink">{musd(Math.floor(r.extraPerYear))} more a year</span>
                          </>
                        )}
                        .
                      </>
                    )}
                  </p>
                  {!there && (
                    <a href={act.url} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-full border border-line px-4 text-sm font-bold no-underline">
                      {act.label}
                      {external && <ArrowUpRightIcon className="size-4" />}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Compared with every ranked place for that same amount: the Savings Vault and Mezo-paid pools on Ethereum, holding 90 days, after costs. Mezo&apos;s own pools show their rates in the Mezo app. Locked veMEZO is not counted as cash. Rates and reward campaigns change week to week.
          </p>
        </section>
      )}

      {data && total >= 1 && <Places amount={total} sources={sources} />}

      {data && (data.trove || (data.veMezo && data.veMezo.unclaimed > 0)) && (
        <section aria-labelledby="more-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
          <h2 id="more-h" className="text-base font-bold">
            Also on this address
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            {data.trove && (
              <li>
                Trove: {musd(data.trove.debt)} borrowed at {data.trove.ratePct}%.
                {vaultApr !== null && vaultApr > data.trove.ratePct ? ` The Savings Vault pays ${pct(vaultApr)}, more than this trove costs.` : ""}{" "}
                <Link href="/trove" className="font-semibold text-accent-text underline">
                  Plan this trove
                </Link>
              </li>
            )}
            {data.veMezo && data.veMezo.unclaimed > 0 && (
              <li>
                {ve(data.veMezo.unclaimed)} veMEZO waiting to be claimed ({usd(data.veMezo.usd)} at MEZO spot).{" "}
                <Link href="/rewards" className="font-semibold text-accent-text underline">
                  How to claim
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      {data && <p className="px-1 text-xs text-ink-muted">Not read yet: Mezo pool LP positions, the Ditto MUSD vault and Ethereum positions.</p>}
    </div>
  );
}
