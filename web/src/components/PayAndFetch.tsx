"use client";

import { ExactEvmScheme } from "@x402/evm";
import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { useState } from "react";
import type { NetworkId } from "@/lib/chain/addresses";
import { mainnetWritesEnabled } from "@/lib/sendSafely";
import { connect, explorerTx, humanError, injected, publicFor } from "@/lib/wallet";
import { PAY_LIMITS, PAY_TO, pickMusdRequirement } from "@/lib/x402";
import { ArrowUpRightIcon } from "./Icons";
import { MainnetConfirm, type MainnetPlan } from "./MainnetConfirm";

type Result = { tx: string | null; payer: string | null; venues: number; combos: number; net: NetworkId };

const PRICE = { testnet: "0.001 test MUSD", mainnet: "0.01 MUSD" } as const;

/** Pays one premium call over x402 from the connected wallet (0.001 test MUSD on testnet, 0.01 real MUSD on mainnet) and fetches the bundle. */
export function PayAndFetch() {
  const [net, setNet] = useState<NetworkId>("testnet");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [plan, setPlan] = useState<MainnetPlan | null>(null);
  const mainnetOn = mainnetWritesEnabled(); // fixed at build time, like the vault's network choice

  const run = async (network: NetworkId) => {
    setError(null);
    setResult(null);
    if (!injected()) {
      setError("No wallet in this browser. Open this page inside MetaMask, Rabby or another wallet's browser.");
      return;
    }
    setBusy(true);
    try {
      const { wallet, account } = await connect(undefined, network);
      const signer = {
        address: account,
        signTypedData: (m: { domain: Record<string, unknown>; types: Record<string, unknown>; primaryType: string; message: Record<string, unknown> }) =>
          wallet.signTypedData({ account, ...m } as never),
        readContract: (a: object) => publicFor(network).readContract(a as never), // EIP-2612 nonce for the exact-amount permit
      };
      const pay = wrapFetchWithPaymentFromConfig(fetch, {
        schemes: [{ network: PAY_LIMITS[network].network, client: new ExactEvmScheme(signer as never) }],
        paymentRequirementsSelector: (_v, reqs) => pickMusdRequirement(reqs, PAY_TO, network),
      });
      const r = await pay("/api/premium/yields?amount=2000");
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `The paid request failed (HTTP ${r.status}).`);
      const header = r.headers.get("PAYMENT-RESPONSE");
      const settled = header ? decodePaymentResponseHeader(header) : null;
      setResult({ tx: settled?.transaction ?? null, payer: settled?.payer ?? null, venues: body.carry?.[0]?.venues?.length ?? 0, combos: body.carry?.length ?? 0, net: network });
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    if (net === "testnet") return void run("testnet");
    setPlan({
      title: "Pay 0.01 MUSD on Mezo mainnet",
      lines: [
        "This is real MUSD. Your wallet signs an exact-amount permit for 0.01 MUSD, never unlimited. The facilitator sends the payment and pays the gas.",
        `The payment goes to ${PAY_TO}. Compass refuses any other token, amount or payee before your wallet is asked.`,
        "You get the premium bundle once the payment settles.",
      ],
      amount: 0.01,
      button: "Pay 0.01 MUSD",
    });
  };

  return (
    <div className="mt-3">
      {mainnetOn && (
        <fieldset className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <legend className="sr-only">Network</legend>
          {(["testnet", "mainnet"] as const).map((n) => (
            <label key={n} className="flex items-center gap-2">
              <input type="radio" name="pay-net" checked={net === n} onChange={() => setNet(n)} disabled={busy} />
              {n === "testnet" ? "Mezo testnet (test funds)" : "Mezo mainnet (real funds)"}
            </label>
          ))}
        </fieldset>
      )}
      <p className="text-sm">
        This button pays <strong>{PRICE[net]}</strong> on Mezo {net}
        {net === "testnet" ? " (apps on mainnet pay 0.01 MUSD, see the table below)" : ""}. Your wallet signs an exact-amount permit (never unlimited) and the payment; the facilitator pays the gas. Before you sign, Compass checks this button&rsquo;s request: only {net === "testnet" ? "testnet" : "mainnet"} MUSD, at most {net === "testnet" ? "0.001" : "0.01"}, to{" "}
        <code className="font-mono text-xs break-all">{PAY_TO}</code>.
      </p>
      <button type="button" onClick={start} disabled={busy} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-60">
        {busy ? "Waiting for your wallet…" : `Pay ${net === "testnet" ? "0.001" : "0.01"} MUSD & fetch`}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger-text">
          {error}
        </p>
      )}
      {result && (
        <p role="status" className="mt-2 text-sm">
          Paid on Mezo {result.net}. Got carry for {result.combos} mode × holding-period combinations ({result.venues} venues each).{" "}
          {result.tx && (
            <a href={explorerTx(result.tx, result.net)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold underline">
              Payment transaction
              <ArrowUpRightIcon className="size-4" title="(opens in a new tab)" />
            </a>
          )}
        </p>
      )}
      <MainnetConfirm
        plan={plan}
        onCancel={() => setPlan(null)}
        onConfirm={() => {
          setPlan(null);
          void run("mainnet");
        }}
      />
    </div>
  );
}
