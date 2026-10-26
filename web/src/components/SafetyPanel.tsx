"use client";

import { useState } from "react";
import { BaseError, ContractFunctionRevertedError, maxUint256, parseUnits } from "viem";
import { smusdAbi } from "@/lib/chain/abis";
import { SAMPLES, TESTNET } from "@/lib/chain/addresses";
import { guard } from "@/lib/sendSafely";
import { humanError, testnetPublic } from "@/lib/wallet";

type Result = { ok: boolean; text: string };

/** Three things a bad page would try. Each runs for real, with no wallet: the first two hit Compass's own guard, the third Mezo testnet. */
const TRIES = [
  {
    id: "unlimited",
    label: "Ask for an unlimited MUSD approval",
    run: async (): Promise<Result> => {
      guard({ address: TESTNET.musd, functionName: "approve", args: [TESTNET.smusd, maxUint256] });
      return { ok: false, text: "Not refused. This is a bug." };
    },
  },
  {
    id: "contract",
    label: "Send to a contract that is not the vault",
    run: async (): Promise<Result> => {
      guard({ address: "0x000000000000000000000000000000000000dEaD", functionName: "transfer", args: [SAMPLES.devWallet, 1n] });
      return { ok: false, text: "Not refused. This is a bug." };
    },
  },
  {
    id: "balance",
    label: "Deposit 1,000,000 MUSD from the sample wallet",
    run: async (): Promise<Result> => {
      // The same simulation every real deposit goes through, against the live testnet vault.
      await testnetPublic.simulateContract({ account: SAMPLES.devWallet, address: TESTNET.smusd, abi: smusdAbi, functionName: "deposit", args: [parseUnits("1000000", 18)] });
      return { ok: false, text: "The simulation passed. This is a bug." };
    },
  },
] as const;

const short = (e: unknown) => {
  const m = e instanceof Error ? ((e as { shortMessage?: string }).shortMessage ?? e.message) : String(e);
  return m.split("\n")[0].slice(0, 180);
};

export function SafetyPanel() {
  const [results, setResults] = useState<Record<string, Result | "busy">>({});
  const tryIt = async (t: (typeof TRIES)[number]) => {
    setResults((r) => ({ ...r, [t.id]: "busy" }));
    let res: Result;
    try {
      res = await t.run();
    } catch (e) {
      // A network failure is not a refusal: only a contract revert counts for the chain test.
      const reverted = e instanceof BaseError && e.walk((x) => x instanceof ContractFunctionRevertedError) !== null;
      res =
        t.id !== "balance"
          ? { ok: true, text: `Refused before any wallet is asked: ${short(e)}` }
          : reverted
            ? { ok: true, text: `Mezo testnet refused it in simulation: ${humanError(e)}` }
            : { ok: false, text: `Could not reach Mezo testnet, try again: ${short(e)}` };
    }
    setResults((r) => ({ ...r, [t.id]: res }));
  };

  return (
    <section aria-labelledby="break-h" className="mx-auto w-full max-w-3xl px-4 pb-8">
      <div className="rounded-[20px] border border-line bg-card px-5 py-5">
        <h2 id="break-h" className="text-base font-bold">
          Try to break it
        </h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Each button runs for real, no wallet needed. The first two go through the same check every Compass transaction passes; the third asks Mezo testnet to simulate it, as every deposit is simulated before you sign.
        </p>
        <ul className="mt-3 space-y-3">
          {TRIES.map((t) => {
            const r = results[t.id];
            return (
              <li key={t.id} className="rounded-2xl border border-line px-4 py-3">
                <button type="button" onClick={() => tryIt(t)} disabled={r === "busy"} className="min-h-11 rounded-full border border-line px-4 text-sm font-bold disabled:opacity-60">
                  {t.label}
                </button>
                <p role="status" className={`mt-2 text-sm ${r && r !== "busy" && !r.ok ? "font-semibold text-danger-text" : ""}`}>
                  {r === "busy" ? "Trying…" : r ? r.text : ""}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          Code: <a href="https://github.com/Soka457han/MUSD-Compass/blob/main/web/src/lib/sendSafely.ts" className="font-semibold text-accent-text underline" target="_blank" rel="noreferrer">web/src/lib/sendSafely.ts</a>
        </p>
      </div>
    </section>
  );
}
