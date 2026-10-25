"use client";

import { ExactEvmScheme } from "@x402/evm";
import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { useState } from "react";
import { connect, explorerTx, humanError, injected, testnetPublic } from "@/lib/wallet";
import { PAY_TO, pickMusdRequirement, X402_NETWORK } from "@/lib/x402";
import { ArrowUpRightIcon } from "./Icons";

type Result = { tx: string | null; payer: string | null; venues: number; combos: number };

/** Pays 0.001 testnet MUSD over x402 from the connected wallet and fetches the premium bundle. */
export function PayAndFetch() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    setError(null);
    setResult(null);
    if (!injected()) {
      setError("No wallet in this browser. Open this page inside MetaMask, Rabby or another wallet's browser.");
      return;
    }
    setBusy(true);
    try {
      const { wallet, account } = await connect();
      const signer = {
        address: account,
        signTypedData: (m: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> }) =>
          wallet.signTypedData({ account, ...m } as never),
        readContract: (a: object) => testnetPublic.readContract(a as never), // EIP-2612 nonce for the exact-amount permit
      };
      const pay = wrapFetchWithPaymentFromConfig(fetch, {
        schemes: [{ network: X402_NETWORK, client: new ExactEvmScheme(signer as never) }],
        paymentRequirementsSelector: (_v, reqs) => pickMusdRequirement(reqs, PAY_TO),
      });
      const r = await pay("/api/premium/yields?amount=2000");
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `The paid request failed (HTTP ${r.status}).`);
      const header = r.headers.get("PAYMENT-RESPONSE");
      const settled = header ? decodePaymentResponseHeader(header) : null;
      setResult({ tx: settled?.transaction ?? null, payer: settled?.payer ?? null, venues: body.carry?.[0]?.venues?.length ?? 0, combos: body.carry?.length ?? 0 });
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <p className="text-sm">
        Pays <strong>0.001 test MUSD</strong> on Mezo testnet. Your wallet signs an exact-amount permit (never unlimited) and the payment; the facilitator pays the gas. Compass checks the request before you sign: only testnet MUSD, at most 0.001, to{" "}
        <code className="font-mono text-xs break-all">{PAY_TO}</code>.
      </p>
      <button type="button" onClick={run} disabled={busy} className="mt-3 inline-flex min-h-11 items-center rounded-sm bg-ink px-4 text-sm font-bold text-label disabled:opacity-60">
        {busy ? "Waiting for your wallet…" : "Pay 0.001 MUSD & fetch"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-text">
          {error}
        </p>
      )}
      {result && (
        <p role="status" className="mt-2 text-sm">
          Paid. Got carry for {result.combos} mode × holding-period combinations ({result.venues} venues each).{" "}
          {result.tx && (
            <a href={explorerTx(result.tx)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold underline">
              Payment transaction
              <ArrowUpRightIcon className="size-4" title="(opens in a new tab)" />
            </a>
          )}
        </p>
      )}
    </div>
  );
}
