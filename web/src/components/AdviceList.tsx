import type { ReactNode } from "react";
import type { Action, Advice } from "@/lib/safety";

// The word is shown as text, so colour is never the only signal.
const LEVEL = {
  act: { word: "Act now", border: "border-danger-text" },
  watch: { word: "Keep an eye", border: "border-locked" },
  ok: { word: "All clear", border: "border-line" },
} as const;

const n = (v: number, d = 0) => v.toLocaleString("en-US", { maximumFractionDigits: d });
const action = (a: Action) => (a.kind === "addColl" ? `add ${n(a.btc, 8)} BTC` : `repay ${n(a.musd, 2)} MUSD`);

/** What to do about a trove, most urgent first. `footer` replaces the "do it in the Mezo app" line where Compass can do it itself. */
export function AdviceList({ advice, targetPct, footer }: { advice: Advice[]; targetPct: number; footer?: ReactNode }) {
  return (
    <ul aria-label="What to do about this trove" className="mt-4 space-y-3">
      {advice.map((a) => (
        <li key={a.title} className={`border-l-4 pl-3 ${LEVEL[a.level].border}`}>
          <p className="text-sm font-semibold">
            <span className="mr-2 rounded-full bg-surface px-2 py-0.5 text-xs">{LEVEL[a.level].word}</span>
            {a.title}
          </p>
          <p className="mt-1 text-xs text-ink-muted">{a.detail}</p>
          {a.actions && (
            <p className="mt-1 text-xs">
              To get back to {targetPct}%: {a.actions.map(action).join(", or ")}. {footer ?? "Do it in the Mezo app."}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
