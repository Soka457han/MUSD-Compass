import { breakEven, type Range } from "./carry/breakEven";
import { entryCheck, minNewTroveAmount, venueCarry, type BorrowParams, type Carry, type CarryInput, type Days, type EntryCheck } from "./carry/carry";
import type { Venue } from "./venue";

export type Query = Omit<CarryInput, "params" | "ratePct"> & { ratePct: number | null };

const DAYS: Days[] = [30, 90, 365];

/** Validates `amount, mode, trove, days, rate`. Every error is a sentence a person can act on. */
export function parseQuery(sp: URLSearchParams): { ok: true; query: Query } | { ok: false; error: string } {
  const num = (k: string) => (sp.get(k) === null || sp.get(k) === "" ? null : Number(sp.get(k)));
  const amount = num("amount") ?? 2000;
  if (!Number.isFinite(amount) || amount < 1 || amount > 10_000_000) return { ok: false, error: "amount must be a number of MUSD between 1 and 10,000,000." };
  const mode = sp.get("mode") ?? "holder";
  if (mode !== "holder" && mode !== "borrower") return { ok: false, error: "mode must be holder or borrower." };
  const trove = sp.get("trove") ?? "new";
  if (trove !== "new" && trove !== "existing") return { ok: false, error: "trove must be new or existing." };
  const days = num("days") ?? 90;
  if (!DAYS.includes(days as Days)) return { ok: false, error: "days must be 30, 90 or 365." };
  const rate = num("rate");
  if (rate !== null && (!Number.isFinite(rate) || rate < 1 || rate > 5)) return { ok: false, error: "rate must be between 1 and 5 (% per year, Mezo's range)." };
  return { ok: true, query: { amount, mode, trove, days: days as Days, ratePct: rate } };
}

export type Sources = {
  venues: Venue[]; // every venue, already marked unavailable where a source failed
  benchmarkId: string; // sMUSD — what break-even compares against
  borrow: BorrowParams & { ratePct: number };
  paramsLive: boolean;
  ethRoundTrip: { usd: number; basis: string } | null;
  mezoPriceUsd: number | null;
};

export type VenueOut = Venue & { carry: Carry; check: EntryCheck; breakEven: { cash: Range; total: Range } | null };

export function buildYields(s: Sources, q: Query) {
  const input: CarryInput = { ...q, ratePct: q.ratePct ?? s.borrow.ratePct, params: s.borrow };
  const minAmount = minNewTroveAmount(s.borrow);
  const notice =
    q.mode === "borrower" && q.trove === "new" && q.amount < minAmount
      ? `New troves need at least ${s.borrow.minNetDebt.toLocaleString("en-US")} MUSD of debt — try ${Math.ceil(minAmount).toLocaleString("en-US")} or use holder mode.`
      : null;

  const withCost = (v: Venue): Venue =>
    v.chain === "Ethereum" && s.ethRoundTrip ? { ...v, rates: { ...v.rates, fixedCostUsd: s.ethRoundTrip.usd } } : v;
  const bench = s.venues.find((v) => v.id === s.benchmarkId && v.status === "ok");

  const venues: VenueOut[] = s.venues.map(withCost).map((v) => ({
    ...v,
    carry: venueCarry(v.rates, input),
    check: entryCheck(v.rates, input),
    breakEven: v.chain === "Ethereum" && bench && v.status === "ok" && (v.rates.liquidApr !== null || v.rates.lockedApr !== null) ? breakEven(v.rates, bench.rates, input) : null,
  }));

  venues.sort((a, b) => {
    if (a.carry.cash === null || b.carry.cash === null) {
      if (a.carry.cash !== b.carry.cash) return a.carry.cash === null ? 1 : -1;
      return (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0);
    }
    return b.carry.cash - a.carry.cash;
  });

  return {
    // When the data was read (newest source), not when this was computed: no clock read, so the page can be prerendered.
    updatedAt: s.venues.reduce((m, v) => (v.updatedAt > m ? v.updatedAt : m), ""),
    assumptions: {
      amount: q.amount,
      mode: q.mode,
      trove: q.trove,
      days: q.days,
      ratePct: input.ratePct,
      borrowParams: s.borrow,
      borrowParamsLive: s.paramsLive,
      holding: `Assumes ${q.days}-day hold`,
      data: "Mainnet data (Mezo + Ethereum). Vault actions in Compass run on Mezo testnet.",
      locked: "🔒 = veMEZO: claimed on Mezo, locked 12 weeks, valued at MEZO spot. Cash carry ranks; total carry adds 🔒.",
      ethRoundTrip: s.ethRoundTrip,
      mezoPriceUsd: s.mezoPriceUsd,
    },
    notice,
    venues,
  };
}
