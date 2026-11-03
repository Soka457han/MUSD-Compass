import { SAFE_ICR, type TroveView } from "@/lib/trove";

const MIN_ICR = 110; // Mezo's liquidation line (%)
const ACT_ICR = 150; // under this, say "act now"

export type Action = { kind: "addColl"; btc: number } | { kind: "repay"; musd: number };
export type Advice = { level: "ok" | "watch" | "act"; title: string; detail: string; actions?: Action[] };

const RANK = { act: 0, watch: 1, ok: 2 } as const;
const n = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
// The tiny subtraction keeps a value that is already exact (0.05 × 1e8 = 5000000.000000001) from rounding up a whole step.
const up = (v: number, decimals: number) => Math.ceil(v * 10 ** decimals - 1e-6) / 10 ** decimals;

/** Mezo's floor: net debt (debt without the gas deposit) cannot drop under minNetDebt, so a repay is impossible past it. */
export const DEFAULT_DEBT_RULES = { minNetDebt: 1800, gasComp: 200 };

/** What a trove's owner should know and do, most urgent first. Pure: it only reads the TroveView. */
export function troveAdvice(t: TroveView, target = SAFE_ICR, rules = DEFAULT_DEBT_RULES): Advice[] {
  if (!t.active) return [];
  const fall = Math.round((1 - MIN_ICR / t.icrPct) * 100); // % BTC can fall before the ratio reaches the liquidation line
  const out: Advice[] = [];

  if (t.recoveryMode) {
    out.push({
      level: "act",
      title: "Mezo is in recovery mode",
      detail: "The whole system's ratio is low, so stricter borrowing and liquidation rules apply until it recovers. A higher ratio on your trove is the safer place to be.",
    });
  }

  if (t.icrPct < target * 100) {
    const repay = up(t.debt - t.collateralUsd / target, 2);
    const repayOk = t.debt - rules.gasComp - repay >= rules.minNetDebt; // a repay may not push the debt under Mezo's minimum
    const actions: Action[] = [{ kind: "addColl", btc: up((target * t.debt - t.collateralUsd) / t.btcUsd, 8) }, ...(repayOk ? [{ kind: "repay", musd: repay } as const] : [])];
    const risk = `At ${n(t.icrPct)}%, BTC ${t.icrPct < ACT_ICR ? "only has to" : "would have to"} fall about ${Math.max(fall, 0)}% before the trove reaches ${MIN_ICR}% and can be liquidated.`;
    out.push(
      t.icrPct < ACT_ICR
        ? {
            level: "act",
            title: "Your ratio is close to the liquidation line",
            detail: `${risk} ${repayOk ? "Add BTC or repay MUSD now." : "Add BTC now: repaying would leave the debt under Mezo's minimum."}`,
            actions,
          }
        : {
            level: "watch",
            title: `Your ratio is under ${target * 100}%`,
            detail: `${risk} ${repayOk ? `You can add BTC or repay MUSD to get back to ${target * 100}%.` : `Add BTC to get back to ${target * 100}%: repaying would leave the debt under Mezo's minimum.`}`,
            actions,
          },
    );
  }

  if (t.ahead === 0) {
    out.push({
      level: "watch",
      title: "Your trove is first in line for redemptions",
      detail:
        "Anyone holding MUSD can redeem it for BTC at $1 per MUSD, starting with the lowest-ratio troves. A redemption repays part of your debt and takes the matching BTC. It is not a penalty, and it does not mean the trove is unsafe.",
    });
  }

  if (t.icrPct >= target * 100 && !t.recoveryMode) {
    out.push({
      level: "ok",
      title: "Your ratio is comfortable",
      detail: `At ${n(t.icrPct)}%, BTC would have to fall about ${fall}% before this trove could be liquidated at ${MIN_ICR}%.`,
    });
  }

  return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
}
