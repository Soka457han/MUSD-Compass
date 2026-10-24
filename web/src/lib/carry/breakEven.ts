// Break-even scan (design §5.2): the amounts where a venue beats sMUSD's cash carry,
// separately for cash and total carry. Dilution can cap the range, fixed costs set its floor.
import { minNewTroveAmount, venueCarry, type CarryInput, type VenueRates } from "./carry";

export type Range = { kind: "never" } | { kind: "from"; min: number } | { kind: "range"; min: number; max: number };

const MAX_AMOUNT = 1_000_000;
const STEP = 1.01; // 1% geometric steps, then bisection at the edges

type Pick = "cash" | "total";

function margin(v: VenueRates, bench: VenueRates, i: CarryInput, amount: number, pick: Pick): number {
  const at = { ...i, amount };
  const mine = venueCarry(v, at)[pick];
  const theirs = venueCarry(bench, at).cash;
  return mine === null || theirs === null ? -Infinity : mine - theirs;
}

function edge(f: (a: number) => number, lo: number, hi: number): number {
  // f(lo) and f(hi) differ in sign; return the point where the margin crosses zero.
  const loPositive = f(lo) > 0;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0 === loPositive) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function scan(v: VenueRates, bench: VenueRates, i: CarryInput, pick: Pick): Range {
  const start = i.mode === "borrower" && i.trove === "new" ? minNewTroveAmount(i.params) : 100;
  const f = (a: number) => margin(v, bench, i, a, pick);
  let prev = start;
  let min: number | null = f(start) > 0 ? start : null;
  for (let a = start * STEP; a <= MAX_AMOUNT; a *= STEP) {
    const positive = f(a) > 0;
    if (min === null && positive) min = Math.ceil(edge(f, prev, a));
    else if (min !== null && !positive) return { kind: "range", min, max: Math.floor(edge(f, prev, a)) };
    prev = a;
  }
  return min === null ? { kind: "never" } : { kind: "from", min };
}

export function breakEven(v: VenueRates, bench: VenueRates, i: CarryInput): { cash: Range; total: Range } {
  return { cash: scan(v, bench, i, "cash"), total: scan(v, bench, i, "total") };
}
