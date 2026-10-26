import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { usd } from "@/lib/format";
import { loadSources } from "@/lib/sources";

export const metadata: Metadata = { title: "Incentive efficiency · MUSD Compass" };

/** Per Mezo-paid campaign: what it pays out per day against the liquidity it holds. */
async function Board() {
  await connection();
  const { venues } = await loadSources();
  const rows = venues
    .filter((v) => v.status === "ok" && v.incentiveUsdPerDay !== undefined && v.tvlUsd)
    .map((v) => ({ v, perK: ((v.incentiveUsdPerDay as number) / (v.tvlUsd as number)) * 1000 }))
    .sort((a, b) => a.perK - b.perK);
  if (!rows.length) return <p className="mt-4 text-sm">Merkl is unavailable right now — no campaigns to compare.</p>;
  return (
    <div className="mt-4 rounded-[20px] border border-line bg-card px-5 py-5">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Mezo-paid MUSD campaigns, most efficient first</caption>
        <thead>
          <tr className="border-b border-line text-xs text-ink-muted">
            <th scope="col" className="py-1 pr-2 font-semibold">Campaign</th>
            <th scope="col" className="py-1 pr-2 text-right font-semibold">Pays / day</th>
            <th scope="col" className="py-1 pr-2 text-right font-semibold">Liquidity</th>
            <th scope="col" className="py-1 text-right font-semibold">Per $1k / day</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ v, perK }) => (
            <tr key={v.id} className="border-b border-line align-baseline">
              <th scope="row" className="py-2 pr-2 font-semibold">{v.name}</th>
              <td className="py-2 pr-2 text-right">{usd(v.incentiveUsdPerDay as number)}</td>
              <td className="py-2 pr-2 text-right">{usd(v.tvlUsd)}</td>
              <td className="price py-2 text-right text-xl">{usd(perK)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-ink-muted">
        From Merkl, in USD as Merkl values the reward. Nested Curve listings (gauge, Stake DAO, Convex) share the same reward stream, so they are not added. Lower per $1k = more liquidity for each dollar of veMEZO.
      </p>
    </div>
  );
}

export default function IncentivesPage() {
  return (
    <>
      <SiteHeader current="/incentives" />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <h1 className="text-[30px] leading-tight font-extrabold tracking-tight md:text-[40px]">
          Incentive efficiency
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">What each Mezo-paid MUSD campaign on Ethereum spends per day, against the liquidity it holds. Mainnet data, refreshed every 5 minutes.</p>
        <Suspense fallback={<p className="mt-4 text-sm">Reading Merkl…</p>}>
          <Board />
        </Suspense>
      </main>
    </>
  );
}
