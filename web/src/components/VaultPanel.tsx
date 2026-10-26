"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { parseUnits, type Address, type WalletClient } from "viem";
import { erc20Abi, smusdAbi } from "@/lib/chain/abis";
import { SAMPLES, TESTNET } from "@/lib/chain/addresses";
import { sendSafely } from "@/lib/sendSafely";
import type { VaultState } from "@/lib/vault";
import { connect, explorerTx, humanError, injected, testnetPublic } from "@/lib/wallet";
import { ArrowUpRightIcon } from "./Icons";
import { WalletModal, type Picked } from "./WalletModal";

type Tx = { label: string; hash?: string; state: "pending" | "done" | "error"; note?: string };

const fmt = (s: string) => Number(s).toLocaleString("en-US", { maximumFractionDigits: 4 });

function ago(ts: number | null) {
  if (!ts) return "no distribution seen in the last 14 days";
  const h = Math.max(0, (Date.now() / 1000 - ts) / 3600);
  return h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`;
}

function toWei(amount: string): bigint | null {
  if (!/^\d+(\.\d{1,18})?$/.test(amount.trim())) return null;
  const v = parseUnits(amount.trim(), 18);
  return v > 0n ? v : null;
}

export function VaultPanel() {
  const [hasWallet, setHasWallet] = useState(true);
  const [wallet, setWallet] = useState<WalletClient | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [lookup, setLookup] = useState("");
  const [state, setState] = useState<VaultState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [txs, setTxs] = useState<Tx[]>([]);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const load = useCallback(async (addr: string) => {
    setLoadError(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/vault/${addr}`);
      const j = await r.json();
      if (!r.ok) {
        setState(null);
        setLoadError(j.error ?? "Could not read the vault.");
        return;
      }
      setState(j);
    } catch {
      setLoadError("Could not reach Compass. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wallet presence and the bot's ?action=deposit&amount=… link are only known in the browser.
    const sp = new URLSearchParams(window.location.search);
    const amt = sp.get("amount");
    setHasWallet(Boolean(injected()));
    if (sp.get("action") === "deposit" && amt && toWei(amt)) setDepositAmt(amt);
  }, []);

  // The picker stays open while the wallet asks; it closes on success and shows the reason on failure.
  const onConnect = async (w: Picked) => {
    setPicked(w);
    setPickError(null);
    let c: Awaited<ReturnType<typeof connect>>;
    try {
      c = await connect(w.provider);
    } catch (e) {
      setPickError(humanError(e));
      return;
    }
    setPicking(false);
    setPicked(null);
    setWallet(c.wallet);
    setAccount(c.account);
    setLookup(c.account);
    await load(c.account);
  };

  const run = async (label: string, steps: { label: string; address: Address; abi: typeof erc20Abi | typeof smusdAbi; functionName: string; args: readonly unknown[] }[]) => {
    if (!wallet || !account) return;
    setBusy(true);
    try {
      for (const s of steps) {
        setTxs((t) => [{ label: s.label, state: "pending" }, ...t]);
        const { hash } = await sendSafely({ publicClient: testnetPublic as never, walletClient: wallet as never, account, ...s });
        setTxs((t) => [{ label: s.label, hash, state: "done" }, ...t.slice(1)]);
      }
    } catch (e) {
      setTxs((t) => [{ label, state: "error", note: humanError(e) }, ...t.slice(1)]);
    } finally {
      setBusy(false);
      await load(account);
    }
  };

  const deposit = () => {
    const wei = toWei(depositAmt);
    if (!wei || !state) return;
    const allowance = parseUnits(state.allowance, 18);
    run("Deposit", [
      ...(allowance < wei ? [{ label: `Approve exactly ${depositAmt} MUSD`, address: TESTNET.musd, abi: erc20Abi, functionName: "approve", args: [TESTNET.smusd, wei] }] : []),
      { label: `Deposit ${depositAmt} MUSD`, address: TESTNET.smusd, abi: smusdAbi, functionName: "deposit", args: [wei] },
    ]);
  };
  const withdraw = () => {
    const wei = toWei(withdrawAmt);
    if (!wei) return;
    run("Withdraw", [{ label: `Withdraw ${withdrawAmt} sMUSD`, address: TESTNET.smusd, abi: smusdAbi, functionName: "withdraw", args: [wei] }]);
  };
  const claim = () => run("Claim yield", [{ label: "Claim yield", address: TESTNET.smusd, abi: smusdAbi, functionName: "claimYield", args: [] }]);

  const own = Boolean(account && state && state.address.toLowerCase() === account.toLowerCase());
  const depositWei = toWei(depositAmt);
  const withdrawWei = toWei(withdrawAmt);
  const depositTooBig = Boolean(state && depositWei && depositWei > parseUnits(state.musd, 18));
  const withdrawTooBig = Boolean(state && withdrawWei && withdrawWei > parseUnits(state.smusd, 18));

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
      <section aria-labelledby="wallet-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
        <h2 id="wallet-h" className="text-base font-bold">
          Wallet
        </h2>
        {account ? (
          <p className="mt-1 text-sm">
            Connected <span className="font-semibold">{account.slice(0, 6)}…{account.slice(-4)}</span> on Mezo testnet.
          </p>
        ) : (
          <>
            <button type="button" onClick={() => setPicking(true)} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-bold text-on-accent">
              Connect wallet
            </button>
            {!hasWallet && (
              <p className="mt-3 max-w-prose text-sm">
                No wallet in this browser. Open this page inside MetaMask, Rabby or another wallet&apos;s browser to deposit. You can still look up any address below.
              </p>
            )}
          </>
        )}
        <WalletModal
          open={picking}
          onClose={() => {
            setPicking(false);
            setPicked(null);
          }}
          onPick={onConnect}
          picked={picked}
          error={pickError}
        />
        <p className="mt-3 text-xs text-ink-muted">
          Need test funds?{" "}
          <Link href="/get-test-musd" className="font-semibold text-ink underline">
            Get test MUSD in 3 steps
          </Link>{" "}
          (faucet BTC, then swap on testnet.mezo.org).
        </p>
      </section>

      <section aria-labelledby="lookup-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
        <h2 id="lookup-h" className="text-base font-bold">
          Savings Vault position
        </h2>
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(lookup.trim());
          }}
        >
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <label htmlFor="lookup" className="mb-1 block text-xs font-semibold">
              Address
            </label>
            <input id="lookup" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} className="block h-11 w-full rounded-full border border-field bg-card px-4 text-sm" />
          </div>
          <button type="submit" className="min-h-11 rounded-full border border-line px-4 text-sm font-bold">
            Look up
          </button>
          <button
            type="button"
            onClick={() => {
              setLookup(SAMPLES.devWallet);
              load(SAMPLES.devWallet);
            }}
            className="min-h-11 px-2 text-sm font-semibold underline"
          >
            Try a sample
          </button>
        </form>
        {loadError && (
          <p role="alert" className="mt-2 text-sm font-semibold text-danger-text">
            {loadError}
          </p>
        )}
        {loading && !state && (
          <div role="status" aria-label="Reading the vault" className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <span className="h-3 w-20 animate-pulse rounded-full bg-surface" />
                <span className="h-8 w-24 animate-pulse rounded-xl bg-surface" />
              </div>
            ))}
          </div>
        )}
        {state && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-ink-muted">In vault (sMUSD)</dt>
              <dd className="price text-[2rem]">{fmt(state.smusd)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Pending yield</dt>
              <dd className="price text-[2rem]">{fmt(state.pendingYield)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Wallet MUSD</dt>
              <dd className="text-base font-semibold">{fmt(state.musd)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Last distribution</dt>
              <dd className="text-base font-semibold">{state.lastDistributionPending ? "still being read, check again in a minute" : ago(state.lastDistribution)}</dd>
            </div>
          </dl>
        )}
        {state && Number(state.pendingYield) === 0 && (
          <p className="mt-3 max-w-prose text-xs text-ink-muted">Pending yield is 0 until the next distribution reaches this position; claiming now pays 0.</p>
        )}
      </section>

      {own && (
        <section aria-labelledby="actions-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
          <h2 id="actions-h" className="text-base font-bold">
            Actions
          </h2>
          <p className="mt-1 max-w-prose text-xs text-ink-muted">Every action is simulated first, sent with a gas limit of the estimate × 1.2, and approvals are for the exact amount only.</p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                deposit();
              }}
            >
              <label htmlFor="dep" className="mb-1 block text-xs font-semibold">
                Deposit MUSD
              </label>
              <input id="dep" inputMode="decimal" value={depositAmt} onChange={(e) => setDepositAmt(e.target.value)} placeholder="100" aria-invalid={depositTooBig} className="price block h-11 w-full rounded-full border border-field bg-card px-4 text-2xl" />
              {depositTooBig && <p className="mt-1 text-xs font-semibold text-danger-text">More than your wallet holds ({fmt(state!.musd)} MUSD).</p>}
              <button type="submit" disabled={busy || !depositWei || depositTooBig} className="mt-2 inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-50">
                Deposit
              </button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                withdraw();
              }}
            >
              <label htmlFor="wd" className="mb-1 block text-xs font-semibold">
                Withdraw sMUSD (also pays pending yield)
              </label>
              <input id="wd" inputMode="decimal" value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} placeholder="10" aria-invalid={withdrawTooBig} className="price block h-11 w-full rounded-full border border-field bg-card px-4 text-2xl" />
              {withdrawTooBig && <p className="mt-1 text-xs font-semibold text-danger-text">More than you have in the vault ({fmt(state!.smusd)}).</p>}
              <button type="submit" disabled={busy || !withdrawWei || withdrawTooBig} className="mt-2 inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-bold disabled:opacity-50">
                Withdraw
              </button>
            </form>
          </div>
          <button type="button" onClick={claim} disabled={busy} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-bold disabled:opacity-50">
            Claim yield
          </button>
        </section>
      )}

      {txs.length > 0 && (
        <section aria-labelledby="tx-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
          <h2 id="tx-h" className="text-base font-bold">
            Transactions
          </h2>
          <ul aria-live="polite" className="mt-2 divide-y divide-line">
            {txs.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-semibold">{t.label}</span>
                <span className={t.state === "error" ? "font-semibold text-danger-text" : "text-ink-muted"}>
                  {t.state === "pending" ? "Waiting for wallet and network…" : t.state === "done" ? "Confirmed" : t.note}
                </span>
                {t.hash && (
                  <a href={explorerTx(t.hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                    View on explorer
                    <ArrowUpRightIcon className="size-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
