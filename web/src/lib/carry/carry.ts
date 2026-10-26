// Pure carry math (design §5.2). No I/O; percentages are numbers (4.23 = 4.23%).

export type Mode = "holder" | "borrower";
export type TroveKind = "new" | "existing";
export type Days = 30 | 90 | 365;

export type BorrowParams = {
  feePct: number; // issuance fee, % of the borrowed amount (0.1)
  gasCompensation: number; // MUSD added to a new trove's debt, returned on close (200)
  minNetDebt: number; // amount + fee must reach this for a new trove (1,800)
};

export type CarryInput = {
  amount: number; // MUSD put to work
  days: Days;
  mode: Mode;
  trove: TroveKind;
  ratePct: number; // borrow rate, 1–5
  params: BorrowParams;
};

export type VenueRates = {
  liquidApr: number | null; // cash yield (fees, sMUSD rate)
  lockedApr: number | null; // veMEZO rewards, priced at MEZO spot
  fixedCostUsd: number; // one-off round-trip cost (bridge + gas); 0 on Mezo
  tvl: number | null; // for diluting fixed reward streams
};

export type Carry = {
  liquid: number | null;
  locked: number | null;
  costs: number;
  cash: number | null;
  total: number | null;
};

/** A one-off cost expressed as %/year over the holding period. */
export function amortisedPct(costUsd: number, amount: number, days: Days): number {
  return (costUsd / amount) * 100 * (365 / days);
}

export function borrowCostPct(i: CarryInput): number {
  if (i.mode === "holder") return 0;
  const fee = i.amount * (i.params.feePct / 100);
  const debt = i.amount + fee + (i.trove === "new" ? i.params.gasCompensation : 0);
  // Interest accrues on the whole debt (BorrowerOperations: compositeDebt), not just the amount at work.
  return i.ratePct * (debt / i.amount) + amortisedPct(fee, i.amount, i.days);
}

/** A fixed reward stream shared by more liquidity: apr × tvl ÷ (tvl + amount). */
export function dilutedApr(apr: number, tvl: number | null, amount: number): number {
  return tvl && tvl > 0 ? (apr * tvl) / (tvl + amount) : apr;
}

/** Smallest amount for a new trove: amount × (1 + fee) ≥ minNetDebt, rounded up to cents. */
export function minNewTroveAmount(p: BorrowParams): number {
  return Math.ceil((p.minNetDebt / (1 + p.feePct / 100)) * 100) / 100;
}

export function venueCarry(v: VenueRates, i: CarryInput): Carry {
  const costs = borrowCostPct(i) + amortisedPct(v.fixedCostUsd, i.amount, i.days);
  if (v.liquidApr === null && v.lockedApr === null) {
    return { liquid: null, locked: null, costs, cash: null, total: null };
  }
  const liquid = v.liquidApr ?? 0;
  const locked = v.lockedApr === null ? 0 : dilutedApr(v.lockedApr, v.tvl, i.amount);
  const cash = liquid - costs;
  return { liquid, locked, costs, cash, total: cash + locked };
}

export type EntryCheck = {
  keepMusd: number | null; // cash kept over the hold, in MUSD (negative = a loss)
  oneOffMusd: number; // bridge round trip + gas, plus the borrow fee
  paybackDays: number | "never" | null; // days until the one-off costs are earned back; null when there are none
};

/** One venue for this amount and hold, in MUSD: what you keep, what you pay up front, and when that is earned back. */
export function entryCheck(v: VenueRates, i: CarryInput): EntryCheck {
  const c = venueCarry(v, i);
  const keepMusd = c.cash === null ? null : (i.amount * c.cash * i.days) / 36_500;
  const fee = i.mode === "borrower" ? i.amount * (i.params.feePct / 100) : 0;
  const oneOffMusd = v.fixedCostUsd + fee;
  if (oneOffMusd === 0 || c.liquid === null) return { keepMusd, oneOffMusd, paybackDays: null };
  const interestPct = borrowCostPct(i) - amortisedPct(fee, i.amount, i.days); // the running cost, without the one-off fee
  const perDay = (i.amount * (c.liquid - interestPct)) / 36_500;
  return { keepMusd, oneOffMusd, paybackDays: perDay > 0 ? Math.ceil(oneOffMusd / perDay) : "never" };
}
