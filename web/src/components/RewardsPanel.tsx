"use client";

import { useState } from "react";
import { SAMPLES } from "@/lib/chain/addresses";
import { shortDate, usd } from "@/lib/format";
import { ArrowUpRightIcon, LockIcon } from "./Icons";

type Rewards = {
  address: string;
  unclaimed: number;
  pending: number;
  usd: number | null;
  campaignEnds: string | null;
  warning: string;
  gas: string;
  path: string[];
  claimUrl: string;
};

const ve = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function RewardsPanel() {
  const [lookup, setLookup] = useState("");
  const [data, setData] = useState<Rewards | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (addr: string) => {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/rewards/${addr}`);
      const j = await r.json();
      if (!r.ok) {
        setData(null);
        setError(j.error ?? "Could not read rewards.");
      } else setData(j);
    } catch {
      setError("Could not reach Compass — check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
      <section aria-labelledby="lookup-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
        <h2 id="lookup-h" className="text-base font-bold">
          Unclaimed veMEZO from Merkl
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">For MUSD liquidity on Ethereum paid by Mezo. Read only — paste any public address.</p>
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
        {busy && <p className="mt-2 text-sm">Reading Merkl…</p>}
        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger-text">
            {error}
          </p>
        )}
        {data && (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <div className="col-span-2">
                <dt className="flex items-center gap-1 text-xs text-ink-muted">
                  <LockIcon className="size-3.5" /> Unclaimed veMEZO
                </dt>
                <dd className="price text-[2.5rem]">{ve(data.unclaimed)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">At MEZO spot</dt>
                <dd className="text-base font-semibold">{usd(data.usd)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Not claimable yet</dt>
                <dd className="text-base font-semibold">{ve(data.pending)}</dd>
              </div>
            </dl>
            {data.unclaimed > 0 ? (
              <div className="mt-4 border-l-4 border-locked pl-3 text-sm">
                <p className="font-semibold">{data.warning}</p>
                <p className="mt-1">
                  Current Mezo campaigns end {data.campaignEnds ? shortDate(data.campaignEnds) : "—"} and usually renew weekly. {data.gas}
                </p>
                <a href={data.claimUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-full bg-accent px-4 font-bold text-on-accent no-underline">
                  Claim on Merkl
                  <ArrowUpRightIcon className="size-4" title="(opens in a new tab)" />
                </a>
              </div>
            ) : (
              <p className="mt-4 text-sm">Nothing to claim for this address right now.</p>
            )}
          </>
        )}
      </section>

      {data && (
        <section aria-labelledby="path-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
          <h2 id="path-h" className="text-base font-bold">
            Where this reward goes
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {data.path.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-ink-muted">Compass ranks venues by cash; this veMEZO is the 🔒 part of their total carry.</p>
        </section>
      )}
    </div>
  );
}
