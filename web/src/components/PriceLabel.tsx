import type { Range } from "@/lib/carry/breakEven";
import { musd, pct, shortDate, usd } from "@/lib/format";
import type { VenueOut } from "@/lib/yields";
import { ArrowUpRightIcon, ChevronIcon, LockIcon } from "./Icons";

/** Big figure: whole number full size, decimals and % raised and smaller. */
function PriceFigure({ value }: { value: number }) {
  // Below 1% the differing digits are the decimals, so keep them full size.
  if (Math.abs(value) < 1) return <>{pct(value)}</>;
  const [whole, frac] = pct(value).replace("%", "").split(".");
  return (
    <>
      {whole}
      <span className="align-top text-[0.55em]">.{frac}%</span>
    </>
  );
}

function rangeText(r: Range): string {
  if (r.kind === "never") return "never at today's rates";
  // Round inward so every amount shown is inside the range (1,798.21 → 1,799, the real trove minimum).
  if (r.kind === "from") return `from ${musd(Math.ceil(r.min))}`;
  return `${musd(Math.ceil(r.min))} – ${musd(Math.floor(r.max))}`;
}

/** One venue as a card: the big figure is cash carry; the line under it is how it was worked out. */
export function PriceLabel({ v, days, lead }: { v: VenueOut; days: number; lead?: boolean }) {
  const { carry } = v;
  const hasCash = carry.cash !== null;
  const locked = carry.locked ?? 0;
  const external = v.action.url.startsWith("http");
  const titleId = `venue-${v.id}`;
  const chip = lead ? "bg-surface" : "bg-card";

  return (
    <article aria-labelledby={titleId} className={`relative flex h-full flex-col rounded-[18px] border border-line md:rounded-[20px] ${lead ? "bg-card" : "bg-surface"}`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <h3 id={titleId} className="text-base leading-snug font-bold">
          {v.name}
        </h3>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold text-ink-muted ${chip}`}>{v.chain}</span>
      </div>

      <div className="mt-3 flex items-end gap-3 px-5">
        {v.status === "unavailable" ? (
          <p className="py-2 text-sm font-semibold">Source unavailable right now</p>
        ) : hasCash ? (
          <p className={`price ${lead ? "text-[56px]" : "text-[40px]"}`}>
            <PriceFigure value={carry.cash!} />
            <span className="sr-only"> cash carry per year</span>
          </p>
        ) : (
          <p className={`price ${lead ? "text-[56px]" : "text-[40px]"}`} aria-label="No steady APR">
            —
          </p>
        )}
        <p className="mb-1 text-xs leading-tight font-semibold text-ink-muted">
          {hasCash ? (
            <>
              cash / yr
              <br />
              after costs
            </>
          ) : (
            <>no steady APR</>
          )}
        </p>
      </div>

      {hasCash && (
        <p className="mx-5 mt-3 text-xs leading-snug text-ink-muted md:max-w-md">
          <span className="font-semibold text-ink">How:</span> {pct(carry.liquid)} yield − {pct(carry.costs)} costs · assumes {days}-day hold
        </p>
      )}

      {locked > 0 && carry.total !== null && (
        <p className="mx-5 mt-3 inline-flex items-center gap-1.5 self-start rounded-full bg-locked px-3 py-1 text-[13px] font-bold text-on-locked">
          <LockIcon className="size-4" />
          +{pct(locked)} locked veMEZO
          <span className="font-semibold">· total {pct(carry.total)}</span>
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 px-5 text-xs">
        <div>
          <dt className="text-ink-muted">Size</dt>
          <dd className="font-semibold">{usd(v.tvlUsd)}</dd>
        </div>
        {v.ends && (
          <div>
            <dt className="text-ink-muted">Rewards end</dt>
            <dd className="font-semibold">{shortDate(v.ends)} (renews weekly)</dd>
          </div>
        )}
        {v.breakEven && hasCash && (
          <div className="col-span-2">
            <dt className="text-ink-muted">Beats sMUSD (cash · with locked)</dt>
            <dd className="font-semibold">
              {rangeText(v.breakEven.cash)} · {rangeText(v.breakEven.total)}
            </dd>
          </div>
        )}
      </dl>

      {v.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 px-5" aria-label="Risk and context">
          {v.tags.map((t) => (
            <li key={t} className={`rounded-full px-2.5 py-0.5 text-xs ${chip}`}>
              {t}
            </li>
          ))}
        </ul>
      )}

      {v.routes.length > 0 && (
        <p className="mt-2 px-5 text-xs text-ink-muted">
          Also via{" "}
          {v.routes.map((r, i) => (
            <span key={r.name + i}>
              {i > 0 && ", "}
              <a href={r.url} className="text-accent-text underline" target="_blank" rel="noreferrer">
                {r.name}
              </a>
            </span>
          ))}{" "}
          — same reward stream, not added.
        </p>
      )}

      <div className="min-h-4 flex-1" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-5 py-3">
        <a
          href={v.action.url}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className={`inline-flex h-11 items-center gap-1.5 rounded-full px-5 text-sm font-bold no-underline ${lead ? "bg-accent text-on-accent" : "border border-line"}`}
        >
          {v.action.label}
          {external && <ArrowUpRightIcon className="size-4" />}
        </a>
        <details className="text-xs">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 font-semibold [&::-webkit-details-marker]:hidden">
            <ChevronIcon className="size-4 transition-transform duration-200 [details[open]_&]:rotate-90" />
            Why this number
          </summary>
          <ul className="mt-1 max-w-prose list-disc space-y-1 pl-4 text-ink-muted">
            {v.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>
              Source:{" "}
              <a href={v.source.url} className="text-accent-text underline" target="_blank" rel="noreferrer">
                {v.source.label}
              </a>
            </li>
          </ul>
        </details>
      </div>
    </article>
  );
}
