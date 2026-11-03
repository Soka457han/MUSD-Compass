"use client";

import { useEffect, useRef, useState } from "react";
import { amountConfirmed } from "@/lib/borrowEarn";

/** What the dialog says and what must be typed before it lets real funds move. */
export type MainnetPlan = { title: string; lines: string[]; amount: number; button: string };

/** Last stop before real funds move: says what happens and asks for the amount to be typed. */
export function MainnetConfirm({ plan, onConfirm, onCancel }: { plan: MainnetPlan | null; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (plan && !d.open) d.showModal();
    if (!plan && d.open) d.close();
    setTyped("");
  }, [plan]);

  return (
    <dialog ref={ref} aria-labelledby="mainnet-confirm-h" onClose={onCancel} className="m-auto w-[min(480px,calc(100%-24px))] rounded-[28px] border-2 border-danger-text bg-card p-6 text-ink backdrop:bg-black/60">
      {plan && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            if (amountConfirmed(typed, plan.amount)) onConfirm();
          }}
        >
          <h2 id="mainnet-confirm-h" className="text-xl font-extrabold">
            {plan.title}
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {plan.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <label htmlFor="mainnet-typed" className="mt-4 block text-xs font-semibold">
            Type {plan.amount} to confirm
          </label>
          <input id="mainnet-typed" inputMode="decimal" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1 block h-11 w-full rounded-full border border-field bg-card px-4 text-sm" />
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={!amountConfirmed(typed, plan.amount)} className="min-h-11 rounded-full bg-accent px-5 text-sm font-bold text-on-accent disabled:opacity-50">
              {plan.button}
            </button>
            <button type="button" onClick={onCancel} className="min-h-11 rounded-full border border-line px-5 text-sm font-bold">
              Cancel
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
