"use client";

import Link from "next/link";
import { useState } from "react";
import { usd } from "@/lib/format";
import type { TroveView } from "@/lib/trove";

type Trove = TroveView & { safeIcrPct: number; minIcrPct: number };

const n = (v: number, d = 0) => v.toLocaleString("en-US", { maximumFractionDigits: d });

/** Calculator link: existing-trove mode at this trove's own rate (only when it is in the calculator's 1–5 % range). */
function calculatorHref(t: Trove): string {
  const p = new URLSearchParams({ mode: "borrower", trove: "existing", days: "90" });
  if (t.ratePct >= 1 && t.ratePct <= 5) p.set("rate", String(t.ratePct));
  if (t.safeExtra >= 1) p.set("amount", String(Math.floor(Math.min(t.safeExtra, 10_000_000))));
  return `/?${p}`;
}

export function TrovePanel() {
  const [lookup, setLookup] = useState("");
  const [t, setT] = useState<Trove | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (addr: string) => {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/trove/${addr}`);
      const j = await r.json();
      if (!r.ok) {
        setT(null);
        setError(j.error ?? "Could not read the trove.");
      } else {
        setT(j);
        if (addr === "sample") setLookup(j.address);
      }
    } catch {
      setError("Could not reach Compass — check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
      <section aria-labelledby="lookup-h" className="border-t-4 border-ink bg-label px-4 py-4">
        <h2 id="lookup-h" className="text-base font-bold" style={{ fontStretch: "90%" }}>
          Your MUSD trove on Mezo
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">Read only, Mezo mainnet. Paste the public address that owns the trove.</p>
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(lookup.trim());
          }}
        >
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <label htmlFor="lookup" className="mb-1 block text-xs font-semibold">
              Address
            </label>
            <input id="lookup" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} className="block h-11 w-full rounded-sm border-2 border-ink bg-label px-2 text-sm" />
          </div>
          <button type="submit" disabled={busy} className="min-h-11 rounded-sm border-2 border-ink px-4 text-sm font-bold disabled:opacity-60">
            Look up
          </button>
          <button type="button" disabled={busy} onClick={() => load("sample")} className="min-h-11 px-2 text-sm font-semibold underline">
            Try a sample
          </button>
        </form>
        {busy && <p className="mt-2 text-sm">Reading Mezo…</p>}
        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger-text">
            {error}
          </p>
        )}
        {t && !t.active && <p className="mt-4 text-sm">This address has no open trove.</p>}
        {t?.active && (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <div>
                <dt className="text-xs text-ink-muted">Collateral ratio</dt>
                <dd className="price text-[2rem]">{n(t.icrPct)}%</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Interest rate</dt>
                <dd className="price text-[2rem]">{n(t.ratePct, 2)}%</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Collateral</dt>
                <dd className="text-base font-semibold">
                  {n(t.collateralBtc, 4)} BTC <span className="font-normal text-ink-muted">({usd(t.collateralUsd)})</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Debt</dt>
                <dd className="text-base font-semibold">{n(t.debt, 2)} MUSD</dd>
              </div>
            </dl>
            {t.recoveryMode && (
              <p role="note" className="mt-3 border-l-4 border-sticker pl-3 text-sm font-semibold">
                Mezo is in recovery mode: borrowing rules are stricter until the system ratio recovers.
              </p>
            )}
          </>
        )}
      </section>

      {t?.active && (
        <section aria-labelledby="plan-h" className="border-t-4 border-ink bg-label px-4 py-4">
          <h2 id="plan-h" className="text-base font-bold" style={{ fontStretch: "90%" }}>
            What you could do
          </h2>
          <dl className="mt-2 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-ink-muted">Borrow more and stay at or above {t.safeIcrPct}%</dt>
              <dd className="price text-[2rem]">{n(t.safeExtra)} MUSD</dd>
              <dd className="mt-1 text-xs text-ink-muted">
                The 0.1% fee is counted. Mezo&apos;s minimum is {t.minIcrPct}%; {t.safeIcrPct}% leaves room for BTC to fall about 45% before you reach it.
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Redemption queue</dt>
              <dd className="font-semibold">
                {t.ahead === null ? "Unavailable right now" : `≈ ${n(t.ahead)} of ${n(t.troves)} troves are redeemed before yours`}
              </dd>
              <dd className="mt-1 text-xs text-ink-muted">Redemptions take collateral from the lowest-ratio troves first. A higher ratio puts you further back.</dd>
            </div>
          </dl>
          <Link href={calculatorHref(t)} className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-ink px-4 text-sm font-bold text-label no-underline">
            Use in calculator
          </Link>
          <p className="mt-2 text-xs text-ink-muted">Opens Yields in borrower mode for an existing trove{t.ratePct >= 1 && t.ratePct <= 5 ? ` at your ${n(t.ratePct, 2)}% rate` : ""}.</p>
          <p className="mt-4 text-xs text-ink-muted">
            Protection tools by other Mezo builders (testnet only, not audited):{" "}
            <a href="https://github.com/nftkingiii/Vigil" target="_blank" rel="noreferrer" className="font-semibold text-ink underline">
              Vigil
            </a>{" "}
            (alerts and a pre-signed rescue) ·{" "}
            <a href="https://github.com/XachP/mezo-lifeline" target="_blank" rel="noreferrer" className="font-semibold text-ink underline">
              Lifeline
            </a>{" "}
            (a rescue reserve and a redemption guard).
          </p>
        </section>
      )}
    </div>
  );
}
