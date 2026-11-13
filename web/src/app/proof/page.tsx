import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { explorerTxUrl, MAINNET_PROOF, TESTNET_PROOF, type ProofTx } from "@/lib/proof";

export const metadata: Metadata = { title: "Proof · MUSD Compass" };

const CARD = "rounded-[20px] border border-line bg-card px-5 py-5";
const GUARD = "https://github.com/Soka457han/MUSD-Compass/blob/main/web/src/lib/sendSafely.ts";
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-4)}`;

function TxList({ rows, network, label }: { rows: ProofTx[]; network: "testnet" | "mainnet"; label: string }) {
  return (
    <ul aria-label={label} className="space-y-3">
      {rows.map((t) => (
        <li key={t.hash} className={`${CARD} text-sm`}>
          <p className="font-semibold">{t.what}</p>
          <p className="mt-1 text-ink-muted">
            {t.amount} · from {t.from}
            {t.date ? ` · ${t.date}` : ""}
          </p>
          <a href={explorerTxUrl(t.hash, network)} target="_blank" rel="noreferrer" aria-label={`${t.what}: transaction ${short(t.hash)} on the explorer`} className="mt-2 inline-block font-mono text-accent-text underline">
            {short(t.hash)}
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function ProofPage() {
  return (
    <>
      <SiteHeader current="/proof" />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
        <div>
          <h1 className="text-[30px] leading-tight font-extrabold tracking-tight md:text-[40px]">Proof: every transaction Compass has sent</h1>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">Compass deploys no contract and holds no funds. Each transaction below was signed by the wallet named in its row. The x402 payments were put on chain by the payment facilitator, which also paid their gas.</p>
        </div>
        <section aria-labelledby="main-h" className="space-y-3">
          <h2 id="main-h" className="text-base font-bold">Mezo mainnet (real funds)</h2>
          {MAINNET_PROOF.length ? (
            <TxList rows={MAINNET_PROOF} network="mainnet" label="Mainnet transactions" />
          ) : (
            <p className={`${CARD} text-sm`}>No mainnet transaction has been sent through Compass yet. Deposit, withdraw, open trove, add BTC and repay passed read-only simulation against Mezo mainnet on 10 Nov 2026.</p>
          )}
        </section>
        <section aria-labelledby="test-h" className="space-y-3">
          <h2 id="test-h" className="text-base font-bold">Mezo testnet (test funds)</h2>
          <TxList rows={TESTNET_PROOF} network="testnet" label="Testnet transactions" />
        </section>
        <section aria-labelledby="check-h" className={`${CARD} space-y-2 text-sm`}>
          <h2 id="check-h" className="text-base font-bold">Check it yourself</h2>
          <p>
            <a href="/vault" className="text-accent-text underline">Open the vault page</a> and press &quot;Try to break it&quot;. It runs the safety checks with no wallet.
          </p>
          <p>
            <a href={GUARD} target="_blank" rel="noreferrer" className="text-accent-text underline">Read the guard source (sendSafely.ts)</a>
          </p>
        </section>
      </main>
    </>
  );
}
