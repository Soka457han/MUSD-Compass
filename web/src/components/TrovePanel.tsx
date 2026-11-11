"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usd } from "@/lib/format";
import { AdviceList } from "./AdviceList";
import { troveAdvice } from "@/lib/safety";
import { mainnetWritesEnabled } from "@/lib/sendSafely";
import { isWallet } from "@/lib/vault";
import type { TroveView } from "@/lib/trove";

type Trove = TroveView & { safeIcrPct: number; minIcrPct: number; market: { musdUsd: number; floorUsd: number; redemptionPct: number } | null };

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
      const r = await fetch(`/api/trove/${encodeURIComponent(addr)}`, { signal: AbortSignal.timeout(25_000) });
      const j = await r.json();
      if (!r.ok) {
        setT(null);
        setError(j.error ?? "Could not read the trove.");
      } else {
        setT(j);
        if (addr === "sample") setLookup(j.address);
      }
    } catch (e) {
      setError(e instanceof DOMException && e.name === "TimeoutError" ? "Mezo is slow to answer right now. Try again in a minute." : "Could not reach Compass — check your connection.");
    } finally {
      setBusy(false);
    }
  };

  // Alert links open /trove?address=0x…: look that trove up once on mount.
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get("address");
    if (a && isWallet(a)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL, which only exists on the client
      setLookup(a);
      load(a);
    }
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
      <section aria-labelledby="lookup-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
        <h2 id="lookup-h" className="text-base font-bold">
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
            <input id="lookup" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} className="block h-11 w-full rounded-full border border-field bg-card px-4 text-sm" />
          </div>
          <button type="submit" disabled={busy} className="min-h-11 rounded-full border border-line px-4 text-sm font-bold disabled:opacity-60">
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
            <AdviceList advice={troveAdvice(t, undefined, undefined, t.market)} targetPct={t.safeIcrPct} footer={mainnetWritesEnabled() ? "Do it in Compass with the link below, or in the Mezo app." : undefined} />
          </>
        )}
      </section>

      {t?.active && (
        <section aria-labelledby="plan-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
          <h2 id="plan-h" className="text-base font-bold">
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
          <Link href={calculatorHref(t)} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-bold text-on-accent no-underline">
            Use in calculator
          </Link>
          <p className="mt-2 text-xs text-ink-muted">Opens Yields in borrower mode for an existing trove{t.ratePct >= 1 && t.ratePct <= 5 ? ` at your ${n(t.ratePct, 2)}% rate` : ""}.</p>
          {mainnetWritesEnabled() && (
            <p className="mt-4 text-sm">
              <Link href="/vault?net=mainnet" className="inline-block py-3 -my-3 font-semibold underline">
                Add BTC or repay MUSD here in Compass
              </Link>{" "}
              <span className="text-ink-muted">(connect the wallet that owns this trove; real funds, you confirm each amount).</span>
            </p>
          )}
          <p className="mt-4 text-xs text-ink-muted">
            From Mezo:{" "}
            <a href="https://mezo.org/borrow" target="_blank" rel="noreferrer" className="inline-block py-3 -my-3 font-semibold text-ink underline">
              Manage this trove in the Mezo app
            </a> ·{" "}
            <a href="https://mezo.org/docs/users/borrow/liquidation-mechanics/" target="_blank" rel="noreferrer" className="inline-block py-3 -my-3 font-semibold text-ink underline">
              How liquidation works
            </a> ·{" "}
            <a href="https://mezo.org/docs/users/borrow/fees/" target="_blank" rel="noreferrer" className="inline-block py-3 -my-3 font-semibold text-ink underline">
              Borrowing fees
            </a>
          </p>
        </section>
      )}
    </div>
  );
}
