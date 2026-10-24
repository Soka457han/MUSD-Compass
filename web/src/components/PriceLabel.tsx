import type { Range } from "@/lib/carry/breakEven";
import { musd, pct, shortDate, usd } from "@/lib/format";
import type { VenueOut } from "@/lib/yields";
import { ArrowUpRightIcon, ChevronIcon, LockIcon } from "./Icons";

/** Shelf-tag lettering: whole number full size, decimals and % raised and smaller. */
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
  if (r.kind === "from") return `from ${musd(r.min)}`;
  return `${musd(r.min)} – ${musd(r.max)}`;
}

/** One venue as a shelf-edge price label: the big figure is cash carry; the boxed line is its unit price. */
export function PriceLabel({ v, days, lead }: { v: VenueOut; days: number; lead?: boolean }) {
  const { carry } = v;
  const hasCash = carry.cash !== null;
  const locked = carry.locked ?? 0;
  const external = v.action.url.startsWith("http");
  const titleId = `venue-${v.id}`;

  return (
    <article aria-labelledby={titleId} className="relative border-t-4 border-ink bg-label shadow-[0_1px_2px_rgb(0_0_0/0.08),0_8px_20px_-12px_rgb(0_0_0/0.25)]">
      <div className="flex items-start justify-between gap-3 px-4 pt-3">
        <h3 id={titleId} className="text-base leading-snug font-bold" style={{ fontStretch: "90%" }}>
          {v.name}
        </h3>
        <span className="shrink-0 rounded-sm border border-ink px-1.5 py-0.5 text-xs font-semibold">{v.chain}</span>
      </div>

      <div className={lead ? "md:flex md:flex-wrap md:items-center md:gap-x-2" : undefined}>
      <div className={`mt-2 flex items-end gap-3 px-4 ${lead ? "bg-yellow py-3 text-on-yellow md:mx-4 md:w-fit md:pr-8" : "pb-1"}`}>
        {v.status === "unavailable" ? (
          <p className="py-2 text-sm font-semibold">Source unavailable right now</p>
        ) : hasCash ? (
          <p className={`price ${lead ? "text-[3.5rem]" : "price-shelf text-[2.5rem]"}`}>
            <PriceFigure value={carry.cash!} />
            <span className="sr-only"> cash carry per year</span>
          </p>
        ) : (
          <p className={`price ${lead ? "text-[3.5rem]" : "text-[2.5rem]"}`} aria-label="No steady APR">
            —
          </p>
        )}
        <p className={`mb-0.5 text-xs leading-tight font-semibold ${lead ? "" : "text-ink-muted"}`}>
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
        <p className="mx-4 mt-2 border border-ink px-2 py-1 text-xs leading-snug md:max-w-md">
          <span className="font-semibold">Unit price:</span> {pct(carry.liquid)} yield − {pct(carry.costs)} costs · assumes {days}-day hold
        </p>
      )}

      {locked > 0 && carry.total !== null && (
        <p className="mx-4 mt-2 inline-flex -rotate-1 items-center gap-1.5 rounded-sm bg-sticker px-2 py-1 text-sm font-bold text-on-sticker">
          <LockIcon className="size-4" />
          +{pct(locked)} locked veMEZO
          <span className="font-semibold">· total {pct(carry.total)}</span>
        </p>
      )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 px-4 text-xs">
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
        <ul className="mt-3 flex flex-wrap gap-1.5 px-4" aria-label="Risk and context">
          {v.tags.map((t) => (
            <li key={t} className="rounded-sm bg-shelf px-1.5 py-0.5 text-xs">
              {t}
            </li>
          ))}
        </ul>
      )}

      {v.routes.length > 0 && (
        <p className="mt-2 px-4 text-xs text-ink-muted">
          Also via{" "}
          {v.routes.map((r, i) => (
            <span key={r.name + i}>
              {i > 0 && ", "}
              <a href={r.url} className="underline" target="_blank" rel="noreferrer">
                {r.name}
              </a>
            </span>
          ))}{" "}
          — same reward stream, not added.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3">
        <a
          href={v.action.url}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-sm px-4 text-sm font-bold ${
            lead ? "bg-ink text-label" : "border-2 border-ink"
          }`}
        >
          {v.action.label}
          {external && <ArrowUpRightIcon className="size-4" />}
        </a>
        <details className="text-xs">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 font-semibold [&::-webkit-details-marker]:hidden">
            <ChevronIcon className="size-4 transition-transform duration-200 [details[open]_&]:rotate-90" />
            Why this number
          </summary>
          <ul className="mt-1 max-w-prose list-disc space-y-1 pl-4">
            {v.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
            <li>
              Source:{" "}
              <a href={v.source.url} className="underline" target="_blank" rel="noreferrer">
                {v.source.label}
              </a>
            </li>
          </ul>
        </details>
      </div>
    </article>
  );
}
