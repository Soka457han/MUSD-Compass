"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatEther, parseUnits, type Abi, type Address, type EIP1193Provider } from "viem";
import { erc20Abi, smusdAbi } from "@/lib/chain/abis";
import { collateralFor, readBorrowSetup, type BorrowSetup } from "@/lib/borrow";
import { assertSafeAtSend, buildBorrowEarnSteps, icrAfterOpen } from "@/lib/borrowEarn";
import { troveAdvice, type Action } from "@/lib/safety";
import { buildRepayStep, buildTopUpStep } from "@/lib/troveActions";
import { readTrove, type TroveView } from "@/lib/trove";
import { NETWORKS, SAMPLES, TESTNET, type NetworkId } from "@/lib/chain/addresses";
import { mainnetWritesEnabled, sendSafely } from "@/lib/sendSafely";
import type { VaultState } from "@/lib/vault";
import { connect, explorerTx, humanError, injected, publicFor } from "@/lib/wallet";
import { walletConnectProjectId, walletConnectProvider } from "@/lib/walletconnect";
import { AdviceList } from "./AdviceList";
import { ArrowUpRightIcon } from "./Icons";
import { MainnetConfirm, type MainnetPlan } from "./MainnetConfirm";
import { WalletModal, type Picked } from "./WalletModal";

type Tx = { label: string; hash?: string; state: "pending" | "done" | "error"; note?: string; network?: NetworkId };
// On mainnet an action waits behind the typed-amount dialog; `go` is what runs once it is confirmed.
type Pending = { view: MainnetPlan; go: () => void };

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
  const [provider, setProvider] = useState<EIP1193Provider | null>(null);
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
  const [setup, setSetup] = useState<BorrowSetup | null>(null);
  const [borrowAmt, setBorrowAmt] = useState("2000");
  const [net, setNet] = useState<NetworkId>("testnet"); // mainnet is only offered when a deploy switches it on
  const [pending, setPending] = useState<Pending | null>(null);
  const [trove, setTrove] = useState<TroveView | null>(null);
  const [topUpAmt, setTopUpAmt] = useState("");
  const [repayAmt, setRepayAmt] = useState("");

  const [loading, setLoading] = useState(false);
  const load = useCallback(async (addr: string) => {
    setLoadError(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/vault/${encodeURIComponent(addr)}`);
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
    let p: EIP1193Provider;
    try {
      if (w.walletConnect) {
        // WalletConnect draws its own QR window, which a modal <dialog> would cover, so the picker steps aside first.
        setPicking(false);
        p = await walletConnectProvider(walletConnectProjectId());
      } else p = w.provider!;
      c = await connect(p);
    } catch (e) {
      setPickError(humanError(e));
      return;
    }
    setPicking(false);
    setPicked(null);
    setProvider(p);
    setAccount(c.account);
    setLookup(c.account);
    await load(c.account);
  };

  // Re-read the trove inputs whenever the vault position is re-read (after connecting and after every transaction).
  useEffect(() => {
    if (account) readBorrowSetup(publicFor(net) as never, account, net).then(setSetup, () => setSetup(null));
  }, [account, state, net]);

  // The caller's own trove on the chosen network, re-read with the borrow setup (after connecting and after every transaction).
  useEffect(() => {
    if (account && setup?.hasTrove) readTrove(publicFor(net) as never, account, setup.feePct, null, net).then(setTrove, () => setTrove(null));
    else setTrove(null);
  }, [account, setup, net]);

  const run = async (
    label: string,
    steps: { label: string; address: Address; abi: Abi; functionName: string; args: readonly unknown[]; value?: bigint }[],
    network: NetworkId = "testnet",
    before?: (step: { functionName: string }) => Promise<void>,
  ) => {
    if (!provider || !account) return;
    setBusy(true);
    try {
      // Re-ask the wallet for this action's Mezo network (a no-op when it is already there), and make sure the account did not change.
      const c = await connect(provider, network);
      if (c.account.toLowerCase() !== account.toLowerCase()) throw new Error("Your wallet switched accounts. Reconnect and try again.");
      for (const s of steps) {
        setTxs((t) => [{ label: s.label, state: "pending", network }, ...t]);
        await before?.(s);
        const { hash } = await sendSafely({ publicClient: publicFor(network) as never, walletClient: c.wallet as never, account, network, walletChainId: await c.wallet.getChainId(), ...s });
        setTxs((t) => [{ label: s.label, hash, state: "done", network }, ...t.slice(1)]);
      }
    } catch (e) {
      setTxs((t) => [{ label, state: "error", note: humanError(e), network }, ...(t[0]?.state === "pending" ? t.slice(1) : t)]);
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
  const borrowWei = toWei(borrowAmt);
  const minBorrow = setup ? Math.ceil(setup.minNetDebt / (1 + setup.feePct / 100)) : 0;
  const coll = setup && borrowWei ? collateralFor(Number(borrowAmt), setup) : null;
  const shortBtc = Boolean(setup && coll !== null && Number(formatEther(coll)) + 0.0001 > setup.btcBalance); // keep a little BTC for gas
  const sendBorrow = (built: Awaited<ReturnType<typeof buildBorrowEarnSteps>>) =>
    run("Borrow → Earn", built.steps, net, async (step) => {
      if (step.functionName === "openTrove") await assertSafeAtSend(publicFor(net) as never, net, built.plan); // BTC may have moved since the quote
      if (step.functionName === "deposit") {
        const held = await publicFor(net).readContract({ address: NETWORKS[net].musd, abi: erc20Abi, functionName: "balanceOf", args: [account!] });
        if (held < built.plan.debt) throw new Error("The borrowed MUSD is not in this wallet yet, so nothing more was sent. Deposit it above once it shows.");
      }
    });
  /** Testnet runs straight away; mainnet asks once more, on screen, with the amount typed in. */
  const gate = (view: MainnetPlan, go: () => void) => (net === "mainnet" ? setPending({ view, go }) : go());
  const failed = (label: string, e: unknown) => setTxs((t) => [{ label, state: "error", note: humanError(e), network: net }, ...t]);
  const borrowEarn = async () => {
    if (!account || !borrowWei) return;
    setBusy(true);
    try {
      const built = await buildBorrowEarnSteps(publicFor(net) as never, net, account, Number(borrowAmt));
      const debt = Number(borrowAmt);
      const btc = formatEther(built.plan.collateral);
      const icrPct = setup ? icrAfterOpen(Number(btc), debt, setup.feePct, setup.gasComp, setup.btcUsd) : 0;
      const fee = setup ? (debt * setup.feePct) / 100 : 0;
      gate(
        {
          title: "Mezo mainnet: real funds",
          amount: debt,
          button: "Open on mainnet",
          lines: [
            `Locks ${btc} BTC as collateral in a new trove.`,
            `Borrows ${debt.toLocaleString("en-US")} MUSD, plus a ${fee.toFixed(2)} MUSD fee and the 200 MUSD gas deposit added to the debt.`,
            `The trove starts at ${icrPct.toFixed(1)}%. Below 110% it can be liquidated, and any trove can be redeemed against at face value.`,
            "Deposits the borrowed MUSD in the Mezo Savings Vault. Three wallet prompts, each simulated first.",
          ],
        },
        () => void sendBorrow(built),
      );
    } catch (e) {
      failed("Borrow → Earn", e);
    } finally {
      setBusy(false);
    }
  };
  const topUp = async () => {
    const btc = Number(topUpAmt);
    if (!account) return;
    setBusy(true);
    try {
      const step = await buildTopUpStep(publicFor(net) as never, net, account, btc);
      gate(
        { title: "Mezo mainnet: real funds", amount: btc, button: "Add on mainnet", lines: [`Adds ${btc} BTC to your trove as collateral.`, "One wallet prompt, simulated first. The ratio goes up; the BTC stays in the trove until it is closed."] },
        () => void run("Add BTC", [step], net),
      );
    } catch (e) {
      failed("Add BTC", e);
    } finally {
      setBusy(false);
    }
  };
  const repay = async () => {
    const musd = Number(repayAmt);
    if (!account) return;
    setBusy(true);
    try {
      const step = await buildRepayStep(publicFor(net) as never, net, account, musd);
      gate(
        { title: "Mezo mainnet: real funds", amount: musd, button: "Repay on mainnet", lines: [`Repays ${musd.toLocaleString("en-US")} MUSD of this trove's debt from your wallet.`, "One wallet prompt, simulated first. The MUSD is burned, and the debt and your ratio improve."] },
        () => void run("Repay MUSD", [step], net),
      );
    } catch (e) {
      failed("Repay MUSD", e);
    } finally {
      setBusy(false);
    }
  };
  const suggestion = (a: Action) => (a.kind === "addColl" ? setTopUpAmt(String(a.btc)) : setRepayAmt(String(a.musd)));
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
            {!picking && pickError && (
              <p role="alert" className="mt-3 text-sm font-semibold text-danger-text">
                {pickError}
              </p>
            )}
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

      {own && setup && (
        <section aria-labelledby="borrow-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
          <h2 id="borrow-h" className="text-base font-bold">
            Borrow MUSD against BTC, then earn
          </h2>
          {mainnetWritesEnabled() && (
            <fieldset className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <legend className="sr-only">Network</legend>
              {(["testnet", "mainnet"] as const).map((n) => (
                <label key={n} className="flex min-h-11 items-center gap-2 font-semibold">
                  <input type="radio" name="net" value={n} checked={net === n} onChange={() => setNet(n)} />
                  {n === "testnet" ? "Mezo testnet (test funds)" : "Mezo mainnet (real funds)"}
                </label>
              ))}
            </fieldset>
          )}
          {net === "mainnet" && (
            <p role="note" className="mt-2 rounded-2xl border-2 border-danger-text px-4 py-2 text-sm font-semibold">
              Mezo mainnet: this opens a real trove with real BTC. You confirm once more on screen before any wallet prompt.
            </p>
          )}
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            Opens a trove on Mezo {net}&apos;s BorrowerOperations with your {net === "mainnet" ? "BTC" : "test BTC"}, then approves exactly that amount and deposits it in the Savings Vault. Three wallet prompts, each simulated first.
          </p>
          {setup.hasTrove ? (
            <p className="mt-3 text-sm">This wallet already has a {net} trove. Deposit its MUSD above; adjust or close the trove in the Mezo app.</p>
          ) : (
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                borrowEarn();
              }}
            >
              <label htmlFor="borrow-amt" className="block text-xs font-semibold">
                Borrow (MUSD, at least {minBorrow.toLocaleString("en-US")})
              </label>
              <input id="borrow-amt" inputMode="decimal" value={borrowAmt} onChange={(e) => setBorrowAmt(e.target.value)} className="block h-11 w-full max-w-xs rounded-full border border-field bg-card px-4 text-sm" />
              {coll !== null && (
                <p className="text-sm text-ink-muted">
                  Locks <span className="font-semibold text-ink">{formatEther(coll)} BTC</span> ({net} price ${setup.btcUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}) for a 200% ratio · fee {(Number(borrowAmt) * setup.feePct / 100).toFixed(2)} MUSD · {setup.gasComp} MUSD gas deposit, returned when the trove closes · you have {setup.btcBalance.toFixed(5)} BTC
                </p>
              )}
              {shortBtc && (
                <p role="alert" className="text-sm font-semibold text-danger-text">
                  Not enough {net === "mainnet" ? "BTC" : "test BTC"} for this trove. {net === "testnet" && <><Link href="/get-test-musd" className="underline">Get test BTC</Link> or </>}{net === "testnet" ? "borrow less." : "Borrow less."}
                </p>
              )}
              <button type="submit" disabled={busy || !borrowWei || Number(borrowAmt) < minBorrow || shortBtc} className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-bold text-on-accent disabled:opacity-50">
                Borrow {borrowWei ? borrowAmt : ""} MUSD and deposit it
              </button>
            </form>
          )}
        </section>
      )}

      {own && setup?.hasTrove && trove?.active && (
        <section aria-labelledby="trove-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
          <h2 id="trove-h" className="text-base font-bold">
            Your {net} trove
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-ink-muted">Collateral ratio</dt>
              <dd className="price text-[2rem]">{trove.icrPct.toLocaleString("en-US", { maximumFractionDigits: 0 })}%</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Debt</dt>
              <dd className="text-base font-semibold">{trove.debt.toLocaleString("en-US", { maximumFractionDigits: 2 })} MUSD</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Collateral</dt>
              <dd className="text-base font-semibold">{trove.collateralBtc.toLocaleString("en-US", { maximumFractionDigits: 6 })} BTC</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Interest rate</dt>
              <dd className="text-base font-semibold">{trove.ratePct.toLocaleString("en-US", { maximumFractionDigits: 2 })}%</dd>
            </div>
          </dl>
          <AdviceList advice={troveAdvice(trove)} targetPct={200} footer="Use the boxes below." />
          {troveAdvice(trove).flatMap((a) => a.actions ?? []).length > 0 && (
            <p className="mt-2 text-xs">
              {troveAdvice(trove)
                .flatMap((a) => a.actions ?? [])
                .map((a) => (
                  <button key={a.kind} type="button" onClick={() => suggestion(a)} className="mr-3 min-h-11 font-semibold underline">
                    Use the suggested {a.kind === "addColl" ? "BTC" : "MUSD"} amount
                  </button>
                ))}
            </p>
          )}
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void topUp();
              }}
            >
              <label htmlFor="topup" className="mb-1 block text-xs font-semibold">
                Add BTC to the trove
              </label>
              <input id="topup" inputMode="decimal" value={topUpAmt} onChange={(e) => setTopUpAmt(e.target.value)} placeholder="0.01" className="block h-11 w-full rounded-full border border-field bg-card px-4 text-sm" />
              <button type="submit" disabled={busy || !(Number(topUpAmt) > 0)} className="mt-2 inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-50">
                Add BTC
              </button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void repay();
              }}
            >
              <label htmlFor="repay" className="mb-1 block text-xs font-semibold">
                Repay MUSD
              </label>
              <input id="repay" inputMode="decimal" value={repayAmt} onChange={(e) => setRepayAmt(e.target.value)} placeholder="100" className="block h-11 w-full rounded-full border border-field bg-card px-4 text-sm" />
              <button type="submit" disabled={busy || !(Number(repayAmt) > 0)} className="mt-2 inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-bold disabled:opacity-50">
                Repay
              </button>
            </form>
          </div>
          <p className="mt-3 max-w-prose text-xs text-ink-muted">Compass can add BTC and repay MUSD. Closing the trove or taking collateral out is done in the Mezo app.</p>
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
                  <a href={explorerTx(t.hash, t.network)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                    View on explorer
                    <ArrowUpRightIcon className="size-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <MainnetConfirm
        plan={pending?.view ?? null}
        onConfirm={() => {
          const p = pending;
          setPending(null);
          p?.go();
        }}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
