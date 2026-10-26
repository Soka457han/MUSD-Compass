"use client";

import Link from "next/link";
import { useState } from "react";
import { SAMPLES } from "@/lib/chain/addresses";
import { musd, pct, usd } from "@/lib/format";
import { compare, type Positions } from "@/lib/positions";
import type { Sources } from "@/lib/yields";
import { ArrowUpRightIcon } from "./Icons";

const ve = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function MyPanel({ sources }: { sources: Sources }) {
  const [lookup, setLookup] = useState("");
  const [data, setData] = useState<Positions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (addr: string) => {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/positions/${addr}`);
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
  const vaultApr =
    sources.venues.find(
      (v) => v.id === sources.benchmarkId && v.status === "ok",
    )?.rates.liquidApr ?? null;
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const nothing =
    data &&
    rows.length === 0 &&
    !data.trove &&
    !(data.veMezo && data.veMezo.unclaimed > 0);

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
      <section
        aria-labelledby="my-h"
        className="rounded-[20px] border border-line bg-card px-5 py-5"
      >
        <h2 id="my-h" className="text-base font-bold">
          Where your MUSD sits, and where it would earn more
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Wallet, Savings Vault, Stability Pool, trove and unclaimed veMEZO on
          Mezo mainnet. Read only: paste any public address.
        </p>
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(lookup.trim());
          }}
        >
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <label
              htmlFor="my-address"
              className="mb-1 block text-xs font-semibold"
            >
              Address
            </label>
            <input
              id="my-address"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              className="block h-11 w-full rounded-full border border-field bg-card px-4 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-full border border-line px-4 text-sm font-bold disabled:opacity-60"
          >
            Look up
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setLookup(SAMPLES.rewards);
              load(SAMPLES.rewards);
            }}
            className="min-h-11 px-2 text-sm font-semibold underline"
          >
            Try a sample
          </button>
        </form>
        {busy && <p className="mt-2 text-sm">Reading Mezo mainnet…</p>}
        {error && (
          <p
            role="alert"
            className="mt-2 text-sm font-semibold text-danger-text"
          >
            {error}
          </p>
        )}
        {data && rows.length > 0 && (
          <p className="mt-4 text-sm text-ink-muted">
            <span className="price block text-[2.5rem] text-ink">
              {musd(total)}
            </span>
            earning on Mezo or waiting in the wallet
          </p>
        )}
        {nothing && (
          <p className="mt-4 text-sm">
            No MUSD, trove or unclaimed veMEZO for this address on Mezo mainnet.
          </p>
        )}
      </section>

      {data && rows.length > 0 && (
        <section
          aria-labelledby="holdings-h"
          className="rounded-[20px] border border-line bg-card px-5 py-5"
        >
          <h2 id="holdings-h" className="text-base font-bold">
            Each holding against the best cash place today
          </h2>
          <ul className="mt-3 space-y-3">
            {rows.map((r) => {
              const there =
                r.extraPerYear === 0 ||
                (r.id !== "wallet" &&
                  r.id !== "stability" &&
                  r.best.id === sources.benchmarkId);
              const external = r.best.action.url.startsWith("http");
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-line px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="text-sm font-bold">{r.label}</h3>
                    <span className="text-base font-extrabold">
                      {musd(r.amount)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {r.nowPct === null
                      ? "No steady APR: earns only when troves are liquidated."
                      : `Earns ${pct(r.nowPct)} cash a year now.`}{" "}
                    {there ? (
                      <span className="font-semibold text-ink">
                        This is the best cash place today.
                      </span>
                    ) : (
                      <>
                        Best now:{" "}
                        <span className="font-semibold text-ink">
                          {r.best.name}
                        </span>{" "}
                        at {pct(r.best.carry.cash)}
                        {r.extraPerYear !== null && r.extraPerYear >= 1 && (
                          <>
                            , about{" "}
                            <span className="font-semibold text-ink">
                              {musd(Math.floor(r.extraPerYear))} more a year
                            </span>
                          </>
                        )}
                        .
                      </>
                    )}
                  </p>
                  {!there && (
                    <a
                      href={r.best.action.url}
                      {...(external
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                      className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-full border border-line px-4 text-sm font-bold no-underline"
                    >
                      {r.best.action.label}
                      {external && <ArrowUpRightIcon className="size-4" />}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Best place for that same amount, holding 90 days, after costs.
            Rewards campaigns renew every 7 days, so the answer can change week
            to week.
          </p>
        </section>
      )}

      {data && (data.trove || (data.veMezo && data.veMezo.unclaimed > 0)) && (
        <section
          aria-labelledby="more-h"
          className="rounded-[20px] border border-line bg-card px-5 py-5"
        >
          <h2 id="more-h" className="text-base font-bold">
            Also on this address
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            {data.trove && (
              <li>
                Trove: {musd(data.trove.debt)} borrowed at {data.trove.ratePct}
                %.
                {vaultApr !== null && vaultApr > data.trove.ratePct
                  ? ` The Savings Vault pays ${pct(vaultApr)}, more than this trove costs.`
                  : ""}{" "}
                <Link
                  href="/trove"
                  className="font-semibold text-accent-text underline"
                >
                  Plan this trove
                </Link>
              </li>
            )}
            {data.veMezo && data.veMezo.unclaimed > 0 && (
              <li>
                {ve(data.veMezo.unclaimed)} veMEZO waiting to be claimed (
                {usd(data.veMezo.usd)} at MEZO spot).{" "}
                <Link
                  href="/rewards"
                  className="font-semibold text-accent-text underline"
                >
                  How to claim
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      {data && (
        <p className="px-1 text-xs text-ink-muted">
          Not read yet: Mezo pool LP and Ethereum positions.
        </p>
      )}
    </div>
  );
}
