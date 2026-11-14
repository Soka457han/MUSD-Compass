"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatEther, parseUnits, type Abi, type Address, type EIP1193Provider } from "viem";
import { erc20Abi, smusdAbi } from "@/lib/chain/abis";
import { collateralFor, readBorrowSetup, type BorrowSetup } from "@/lib/borrow";
import { assertSafeAtSend, buildBorrowEarnSteps, icrAfterOpen } from "@/lib/borrowEarn";
import { troveAdvice, type Action } from "@/lib/safety";
import { buildRepayStep, buildTopUpStep } from "@/lib/troveActions";
import { previewTrove, readTrove, type TroveView } from "@/lib/trove";
import { buildClaimMezoStep, buildStakeSteps, buildUnstakeStep } from "@/lib/gaugeActions";
import { NETWORKS, SAMPLES, type NetworkId } from "@/lib/chain/addresses";
import { MAINNET_CAP_MUSD, mainnetWritesEnabled, sendSafely } from "@/lib/sendSafely";
import type { VaultState } from "@/lib/vault";
import { connect, explorerTx, humanError, injected, publicFor, remember, restoreWallet } from "@/lib/wallet";
import { walletConnectEnabled, walletConnectProjectId, walletConnectProvider } from "@/lib/walletconnect";
import { bitcoinAccount } from "@/lib/bitcoinWallet";
import { AdviceList } from "./AdviceList";
import { ArrowUpRightIcon } from "./Icons";
import { MainnetConfirm, type MainnetPlan } from "./MainnetConfirm";
import { WalletModal, type Picked } from "./WalletModal";

type Tx = { label: string; hash?: string; state: "pending" | "done" | "error"; note?: string; network?: NetworkId };
// On mainnet an action waits behind the typed-amount dialog; `go` is what runs once it is confirmed.
type Pending = { view: MainnetPlan; go: () => void };

const CAP = MAINNET_CAP_MUSD.toLocaleString("en-US");
const REAL = "Mezo mainnet: real funds";
const troveKey = (t: TroveView) => `${t.address.toLowerCase()}:${t.nicr}`;
const fmt = (s: string) => Number(s).toLocaleString("en-US", { maximumFractionDigits: 4 });
const pct = (v: number) => `${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}%`;
type Market = { musdUsd: number; floorUsd: number };
type TroveApi = { icrPct?: number; ahead: number | null; troves: number; market: Market | null; preview?: { icrPct: number; ahead: number | null; troves: number } };

/** Compass's mainnet trove read (redemption queue and MUSD price). Any failure is null: the caller then shows what it already knows. */
async function troveApi(account: Address, query = ""): Promise<TroveApi | null> {
  try {
    const r = await fetch(`/api/trove/${account}${query}`, { signal: AbortSignal.timeout(8_000) }); // a slow answer must not hold up the dialog for long
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

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
  const [connecting, setConnecting] = useState(false);
  const [btcView, setBtcView] = useState<Address | null>(null); // a Bitcoin wallet's Mezo account: looked up, never "own"
  const [setup, setSetup] = useState<BorrowSetup | null>(null);
  const [borrowAmt, setBorrowAmt] = useState("2000");
  const [net, setNet] = useState<NetworkId>("testnet"); // mainnet is only offered when a deploy switches it on
  const [pending, setPending] = useState<Pending | null>(null);
  const [trove, setTrove] = useState<TroveView | null>(null);
  const [topUpAmt, setTopUpAmt] = useState("");
  const [repayAmt, setRepayAmt] = useState("");
  const [queue, setQueue] = useState<{ for: string; ahead: number | null; troves: number; market: Market | null } | null>(null); // mainnet only
  const [stakeAmt, setStakeAmt] = useState("");
  const [unstakeAmt, setUnstakeAmt] = useState("");

  const [loading, setLoading] = useState(false);
  const asked = useRef(0);
  const sending = useRef(false);
  const load = useCallback(async (addr: string, network: NetworkId) => {
    // Only the newest request may fill the page: an answer for the other network must never show under this one's label.
    if (!addr) return setLoadError("Paste a 0x address first, or press Try a sample.");
    const mine = ++asked.current;
    setLoadError(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/vault/${encodeURIComponent(addr)}${network === "mainnet" ? "?network=mainnet" : ""}`);
      const j = await r.json();
      if (mine !== asked.current) return;
      if (!r.ok) {
        setState(null);
        setLoadError(j.error ?? "Could not read the vault.");
        return;
      }
      setState(j);
    } catch {
      if (mine === asked.current) setLoadError("Could not reach Compass. Check your connection and try again.");
    } finally {
      if (mine === asked.current) setLoading(false);
    }
  }, []);

  /** Switch the whole page to one Mezo network: the old network's numbers are cleared before the new ones are read. */
  const chooseNet = (n: NetworkId) => {
    if (n === net || (n === "mainnet" && !mainnetWritesEnabled())) return;
    setNet(n);
    setState(null);
    setSetup(null);
    setTrove(null);
    setPending(null);
    setStakeAmt("");
    setUnstakeAmt("");
    asked.current++; // drops any answer still on its way for the old network
    setLoading(false);
    if (lookup.trim()) void load(lookup.trim(), n);
  };

  useEffect(() => {
    // Wallet presence and the bot's ?action=deposit&amount=… link are only known in the browser.
    const sp = new URLSearchParams(window.location.search);
    const amt = sp.get("amount");
    setHasWallet(Boolean(injected()));
    if (sp.get("action") === "deposit" && amt && toWei(amt)) setDepositAmt(amt);
    // Links from the trove page and the alerts open /vault?net=mainnet. It only counts where a deploy switched mainnet on.
    if (sp.get("net") === "mainnet" && mainnetWritesEnabled()) setNet("mainnet");
  }, []);

  // The picker stays open while the wallet asks; it closes on success and shows the reason on failure.
  const onConnect = async (w: Picked) => {
    setPicked(w);
    setPickError(null);
    setConnecting(true); // the network choice is locked until the wallet answers, so the answer cannot land under the other network
    if (w.bitcoin) {
      try {
        const { account: a } = await bitcoinAccount(w.bitcoin);
        setPicking(false);
        setPicked(null);
        setAccount(null); // a Bitcoin view replaces any connected wallet: nothing on the page may act for it
        setProvider(null);
        setBtcView(a);
        setLookup(a);
        await load(a, net);
      } catch (e) {
        setPickError(humanError(e));
      } finally {
        setConnecting(false);
      }
      return;
    }
    let c: Awaited<ReturnType<typeof connect>>;
    let p: EIP1193Provider;
    try {
      if (w.walletConnect) {
        // WalletConnect draws its own QR window, which a modal <dialog> would cover, so the picker steps aside first.
        setPicking(false);
        p = await walletConnectProvider(walletConnectProjectId());
      } else p = w.provider!;
      c = await connect(p, net);
    } catch (e) {
      setPickError(humanError(e));
      setConnecting(false);
      return;
    }
    setConnecting(false);
    setBtcView(null);
    setPicking(false);
    setPicked(null);
    setProvider(p);
    setAccount(c.account);
    setLookup(c.account);
    remember(w.walletConnect ? null : w.name); // a browser wallet comes back after a refresh; WalletConnect needs its QR again
    await load(c.account, net);
  };

  // After a refresh, reconnect the browser wallet used last time. eth_accounts never opens a wallet popup: it answers only if the site is already allowed.
  useEffect(() => {
    let done = false;
    return restoreWallet((p, a) => {
      if (done) return;
      done = true;
      const n: NetworkId = new URLSearchParams(window.location.search).get("net") === "mainnet" && mainnetWritesEnabled() ? "mainnet" : "testnet";
      setProvider(p);
      setAccount(a);
      setLookup(a);
      void load(a, n);
    });
  }, [load]);

  // Re-read the trove inputs whenever the vault position is re-read (after connecting and after every transaction).
  useEffect(() => {
    if (!account) return;
    let current = true; // a read for the other network, or an older one, must not land here
    readBorrowSetup(publicFor(net) as never, account, net).then((v) => current && setSetup(v), () => current && setSetup(null));
    return () => {
      current = false;
    };
  }, [account, state, net]);

  // The caller's own trove on the chosen network, re-read with the borrow setup (after connecting and after every transaction).
  useEffect(() => {
    if (!(account && setup?.hasTrove)) return setTrove(null);
    let current = true;
    readTrove(publicFor(net) as never, account, setup.feePct, null, net).then((v) => current && setTrove(v), () => current && setTrove(null));
    return () => {
      current = false;
    };
  }, [account, setup, net]);

  // Mainnet only: the redemption queue and the MUSD price are not in the browser read, so ask Compass's trove API once per read.
  useEffect(() => {
    if (!(account && trove?.active && net === "mainnet")) return;
    let current = true;
    troveApi(account).then((j) => current && j && setQueue({ for: troveKey(trove), ahead: j.ahead, troves: j.troves, market: j.market ?? null }));
    return () => {
      current = false;
    };
  }, [account, trove, net]);

  // The sections below also show for an address that was only looked up, with every control off. Acting needs the connected wallet to own it.
  const own = Boolean(account && state && state.address.toLowerCase() === account.toLowerCase());
  const run = async (
    label: string,
    steps: { label: string; address: Address; abi: Abi; functionName: string; args: readonly unknown[]; value?: bigint }[],
    network: NetworkId, // always stated by the caller: a forgotten argument must never fall back to another network
    before?: (step: { functionName: string }) => Promise<void>,
  ) => {
    if (!own || !provider || !account || sending.current) return; // only for the wallet's own address, and one sequence at a time even if a button fires twice
    sending.current = true;
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
      sending.current = false;
      setBusy(false);
      await load(account, network);
    }
  };

  /** Testnet runs straight away; mainnet asks once more, on screen, with the amount typed in. */
  const gate = (view: MainnetPlan, go: () => void) => (net === "mainnet" ? setPending({ view, go }) : go());
  const deposit = () => {
    const wei = toWei(depositAmt);
    if (!wei || !state) return;
    const on = NETWORKS[net];
    const approve = parseUnits(state.allowance, 18) < wei;
    const steps = [
      ...(approve ? [{ label: `Approve exactly ${depositAmt} MUSD`, address: on.musd, abi: erc20Abi, functionName: "approve", args: [on.smusd, wei] }] : []),
      { label: `Deposit ${depositAmt} MUSD`, address: on.smusd, abi: smusdAbi, functionName: "deposit", args: [wei] },
    ];
    gate(
      {
        title: REAL,
        amount: Number(depositAmt),
        button: "Deposit on mainnet",
        lines: [
          `Moves ${depositAmt} MUSD from your wallet into the Mezo Savings Vault.`,
          approve ? "Two wallet prompts: an approval for exactly this amount, then the deposit. Each is simulated first." : "One wallet prompt, simulated first.",
          `Compass deposits at most ${CAP} MUSD per transaction on mainnet.`,
        ],
      },
      () => void run("Deposit", steps, net),
    );
  };
  const withdraw = () => {
    const wei = toWei(withdrawAmt);
    if (!wei) return;
    const steps = [{ label: `Withdraw ${withdrawAmt} sMUSD`, address: NETWORKS[net].smusd, abi: smusdAbi, functionName: "withdraw", args: [wei] }];
    gate(
      { title: REAL, amount: Number(withdrawAmt), button: "Withdraw on mainnet", lines: [`Takes ${withdrawAmt} sMUSD out of the Mezo Savings Vault and back to your wallet as MUSD, with any pending yield.`, "One wallet prompt, simulated first."] },
      () => void run("Withdraw", steps, net),
    );
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
      const m = net === "mainnet" ? (await troveApi(account))?.market : null;
      const pressure =
        m && m.musdUsd < m.floorUsd
          ? [`MUSD trades at $${m.musdUsd.toFixed(4)}, under the $${m.floorUsd.toFixed(4)} redemption floor, so redeeming MUSD for BTC pays right now. Redemptions start with the lowest-ratio troves, and a new trove at 200% can be reached once the troves below it are used up.`]
          : [];
      gate(
        {
          title: REAL,
          amount: debt,
          button: "Open on mainnet",
          lines: [
            `Locks ${btc} BTC as collateral in a new trove.`,
            `Borrows ${debt.toLocaleString("en-US")} MUSD, plus a ${fee.toFixed(2)} MUSD fee and the 200 MUSD gas deposit added to the debt.`,
            `The trove starts at ${icrPct.toFixed(1)}%. Below 110% it can be liquidated, and any trove can be redeemed against at face value.`,
            ...pressure,
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
  /** The trove's ratio after a change, computed here from the browser's own read. Null when previewTrove refuses the change. */
  const localPreview = (change: { addBtc?: number; repayMusd?: number }) => {
    if (!trove) return null;
    try {
      return previewTrove(trove, change, null);
    } catch {
      return null;
    }
  };
  const previewHint = (change: { addBtc?: number; repayMusd?: number }) => {
    const p = localPreview(change);
    return p && `Ratio after: ${pct(p.icrPct)} (now ${pct(trove!.icrPct)}).`;
  };
  /** The confirm dialog's line: with the redemption queue from Compass when it answers, the local ratio alone when it does not. */
  const ratioLine = async (change: { addBtc?: number; repayMusd?: number }, query: string) => {
    const p = localPreview(change);
    if (!p) return null;
    const ratio = `Your ratio goes from ${pct(trove!.icrPct)} to ${pct(p.icrPct)}.`;
    const j = await troveApi(account!, query);
    // The queue is a copy up to 5 minutes old, so the places are stated as about.
    return j?.preview && j.preview.ahead !== null && j.ahead !== null ? `${ratio} Troves redeemed before yours: about ${j.ahead} now, about ${j.preview.ahead} after, of ${j.preview.troves}.` : ratio;
  };
  const topUp = async () => {
    const btc = Number(topUpAmt);
    if (!account) return;
    setBusy(true);
    try {
      const step = await buildTopUpStep(publicFor(net) as never, net, account, btc);
      const after = net === "mainnet" ? await ratioLine({ addBtc: btc }, `?addBtc=${encodeURIComponent(topUpAmt.trim())}`) : null;
      gate(
        { title: REAL, amount: btc, button: "Add on mainnet", lines: [`Adds ${btc} BTC to your trove as collateral.`, ...(after ? [after] : []), "One wallet prompt, simulated first. The ratio goes up; the BTC stays in the trove until it is closed."] },
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
      const after = net === "mainnet" ? await ratioLine({ repayMusd: musd }, `?repayMusd=${encodeURIComponent(repayAmt.trim())}`) : null;
      gate(
        { title: REAL, amount: musd, button: "Repay on mainnet", lines: [`Repays ${musd.toLocaleString("en-US")} MUSD of this trove's debt from your wallet.`, ...(after ? [after] : []), "One wallet prompt, simulated first. The MUSD is burned, and the debt and your ratio improve."] },
        () => void run("Repay MUSD", [step], net),
      );
    } catch (e) {
      failed("Repay MUSD", e);
    } finally {
      setBusy(false);
    }
  };
  const stake = async () => {
    const wei = toWei(stakeAmt);
    if (!account || !wei) return;
    setBusy(true);
    try {
      const steps = await buildStakeSteps(publicFor("mainnet") as never, account, wei);
      gate(
        {
          title: REAL,
          amount: Number(stakeAmt),
          button: "Stake on mainnet",
          lines: [
            `Moves ${stakeAmt} sMUSD from your wallet into Mezo's Savings Vault gauge.`,
            steps.length > 1 ? "Two wallet prompts: an approval for exactly this amount, then the stake. Each is simulated first." : "One wallet prompt, simulated first.",
            "Staked sMUSD earns MEZO and stops earning the vault's fee yield, which goes to veBTC voters instead (Mezo docs).",
          ],
        },
        () => void run("Stake", steps, "mainnet"),
      );
    } catch (e) {
      failed("Stake", e);
    } finally {
      setBusy(false);
    }
  };
  const unstake = async () => {
    const wei = toWei(unstakeAmt);
    if (!account || !wei) return;
    setBusy(true);
    try {
      const step = await buildUnstakeStep(publicFor("mainnet") as never, account, wei);
      gate(
        { title: REAL, amount: Number(unstakeAmt), button: "Unstake on mainnet", lines: [`Takes ${unstakeAmt} sMUSD out of the gauge and back to your wallet.`, "One wallet prompt, simulated first. Back in your wallet, the sMUSD earns the vault's fee yield again and no more MEZO."] },
        () => void run("Unstake", [step], "mainnet"),
      );
    } catch (e) {
      failed("Unstake", e);
    } finally {
      setBusy(false);
    }
  };
  const claimMezo = () => account && run("Claim MEZO", [buildClaimMezoStep(account)], "mainnet"); // only pays the account itself, so no typed amount
  const suggestion = (a: Action) => (a.kind === "addColl" ? setTopUpAmt(String(a.btc)) : setRepayAmt(String(a.musd)));
  const claim = () => run("Claim yield", [{ label: "Claim yield", address: NETWORKS[net].smusd, abi: smusdAbi, functionName: "claimYield", args: [] }], net);

  const depositWei = toWei(depositAmt);
  const withdrawWei = toWei(withdrawAmt);
  const depositTooBig = Boolean(state && depositWei && depositWei > parseUnits(state.musd, 18));
  const withdrawTooBig = Boolean(state && withdrawWei && withdrawWei > parseUnits(state.smusd, 18));
  const depositOverCap = net === "mainnet" && Number(depositAmt) > MAINNET_CAP_MUSD;
  const borrowOverCap = net === "mainnet" && Number(borrowAmt) > MAINNET_CAP_MUSD;
  const sample = net === "mainnet" ? SAMPLES.positions : SAMPLES.devWallet;
  const gaugeRead = Boolean(state && state.staked != null && state.earnedMezo != null);
  const isBtcView = Boolean(btcView && state && state.address.toLowerCase() === btcView.toLowerCase());
  const stakeWei = toWei(stakeAmt);
  const unstakeWei = toWei(unstakeAmt);
  const stakeTooBig = Boolean(state && stakeWei && stakeWei > parseUnits(state.smusd, 18));
  const stakeOverCap = Number(stakeAmt) > MAINNET_CAP_MUSD;
  const unstakeTooBig = Boolean(gaugeRead && unstakeWei && unstakeWei > parseUnits(state!.staked!, 18));
  const q = queue && trove && queue.for === troveKey(trove) ? queue : null; // an answer for another trove, or for this one before it changed, is not used
  const advice = trove ? troveAdvice(q ? { ...trove, ahead: q.ahead, troves: q.troves } : trove, undefined, undefined, q?.market) : [];
  const topUpHint = Number(topUpAmt) > 0 ? previewHint({ addBtc: Number(topUpAmt) }) : null;
  const repayHint = Number(repayAmt) > 0 ? previewHint({ repayMusd: Number(repayAmt) }) : null;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
      <section aria-labelledby="wallet-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
        <h2 id="wallet-h" className="text-base font-bold">
          Wallet
        </h2>
        {mainnetWritesEnabled() && (
          <fieldset disabled={busy || connecting} className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <legend className="sr-only">Network</legend>
            {(["testnet", "mainnet"] as const).map((n) => (
              <label key={n} className="flex min-h-11 items-center gap-2 font-semibold">
                <input type="radio" name="net" value={n} checked={net === n} onChange={() => chooseNet(n)} />
                {n === "testnet" ? "Mezo testnet (test funds)" : "Mezo mainnet (real funds)"}
              </label>
            ))}
          </fieldset>
        )}
        {net === "mainnet" && (
          <p role="note" className="mt-2 rounded-2xl border-2 border-danger-text px-4 py-2 text-sm font-semibold">
            {REAL}. Every action on this page now uses real MUSD and BTC. A deposit, a withdrawal, a new trove, a top-up, a repayment, a stake and an unstake each ask you to type the amount before any wallet prompt. Compass limits each deposit, stake and new trove to {CAP} MUSD as its own safety limit. Mezo sets no maximum, so use the Mezo app for more.
          </p>
        )}
        {account ? (
          <p className="mt-1 text-sm">
            Connected <span className="font-semibold">{account.slice(0, 6)}…{account.slice(-4)}</span> on Mezo {net}.
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
            {btcView && state?.address.toLowerCase() === btcView.toLowerCase() && (
              <p className="mt-3 max-w-prose text-sm">
                Showing the Mezo account of your Bitcoin wallet ({btcView.slice(0, 6)}…{btcView.slice(-4)}), view only. To deposit or withdraw with a Bitcoin wallet, use the Mezo app at mezo.org.
              </p>
            )}
            {!hasWallet && !btcView && (
              <p className="mt-3 max-w-prose text-sm">
                No browser wallet found. Press Connect wallet to use {walletConnectEnabled() ? "WalletConnect or a Bitcoin wallet (view only)" : "a Bitcoin wallet (view only)"}, or open this page inside MetaMask, Rabby or another wallet&apos;s browser to deposit. You can still look up any address below.
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
          network={net}
        />
        {net === "testnet" && (
          <p className="mt-3 text-xs text-ink-muted">
            Need test funds?{" "}
            <Link href="/get-test-musd" className="font-semibold text-ink underline">
              Get test MUSD in 3 steps
            </Link>{" "}
            (faucet BTC, then swap on testnet.mezo.org).
          </p>
        )}
      </section>

      <section aria-labelledby="lookup-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
        <h2 id="lookup-h" className="text-base font-bold">
          Savings Vault position{mainnetWritesEnabled() ? ` on Mezo ${net}` : ""}
        </h2>
        <form
          className="mt-2 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(lookup.trim(), net);
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
              setLookup(sample);
              load(sample, net);
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
              <dt className="text-xs text-ink-muted">{state.staked != null ? "In vault, not staked (sMUSD)" : "In vault (sMUSD)"}</dt>
              <dd className="price text-[2rem]">{fmt(state.smusd)}</dd>
            </div>
            {state.staked != null && (
              <div>
                <dt className="text-xs text-ink-muted">Staked in the gauge (sMUSD)</dt>
                <dd className="price text-[2rem]">{fmt(state.staked)}</dd>
              </div>
            )}
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
          <p className="mt-3 max-w-prose text-xs text-ink-muted">Pending yield is 0 until the next distribution reaches this position, so there is nothing to claim yet.</p>
        )}
      </section>

      {state && (
        <section aria-labelledby="actions-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
          <h2 id="actions-h" className="text-base font-bold">
            Actions
          </h2>
          {!own && (
            <p role="note" className="mt-2 rounded-2xl bg-surface px-4 py-2 text-sm">
              {isBtcView ? "These are the real numbers for your Bitcoin wallet's Mezo account. Bitcoin-wallet accounts act in the Mezo app, so the buttons here stay off." : "These are the real numbers for this address. The buttons stay off until you connect the wallet that owns it."}
            </p>
          )}
          <p className="mt-1 max-w-prose text-xs text-ink-muted">Every action is simulated first, sent with a gas limit of the estimate × 1.2, and approvals are for the exact amount only.</p>

          <fieldset disabled={!own} className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">Savings Vault actions</legend>
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
              {depositOverCap && <p className="mt-1 text-xs font-semibold text-danger-text">Compass deposits at most {CAP} MUSD per transaction on mainnet. Deposit less, or use the Mezo app for more.</p>}
              <button type="submit" disabled={busy || !depositWei || depositTooBig || depositOverCap} className="mt-2 inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-50">
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
          <button type="button" onClick={claim} disabled={busy || !(Number(state.pendingYield) > 0)} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-bold disabled:opacity-50">
            Claim yield
          </button>
          {!(Number(state.pendingYield) > 0) && <p className="mt-1 text-xs text-ink-muted">Nothing to claim yet, so Claim yield stays off and costs you no gas.</p>}
          </fieldset>
        </section>
      )}

      {net === "mainnet" && state && (
        <section aria-labelledby="gauge-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
          <h2 id="gauge-h" className="text-base font-bold">
            Stake in Mezo&apos;s gauge to earn MEZO
          </h2>
          <p className="mt-1 text-sm font-semibold">{gaugeRead ? `Staked: ${fmt(state.staked!)} sMUSD. MEZO to claim: ${fmt(state.earnedMezo!)}.` : "Could not read the gauge right now."}</p>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            Staking moves sMUSD from your wallet into Mezo&apos;s Savings Vault gauge. The staked part earns MEZO and stops earning the vault&apos;s fee yield, which goes to veBTC voters (Mezo docs). Unstake returns the sMUSD to your wallet.
          </p>
          {!own && (
            <p role="note" className="mt-2 rounded-2xl bg-surface px-4 py-2 text-sm">
              {isBtcView ? "These are the real numbers for your Bitcoin wallet's Mezo account. Bitcoin-wallet accounts act in the Mezo app, so the buttons here stay off." : "These are the real numbers for this address. The buttons stay off until you connect the wallet that owns it."}
            </p>
          )}
          <fieldset disabled={!own} className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">Gauge actions</legend>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void stake();
              }}
            >
              <label htmlFor="stake" className="mb-1 block text-xs font-semibold">
                Stake sMUSD
              </label>
              <input id="stake" inputMode="decimal" value={stakeAmt} onChange={(e) => setStakeAmt(e.target.value)} placeholder="100" disabled={!gaugeRead} aria-invalid={stakeTooBig || stakeOverCap} className="block h-11 w-full rounded-full border border-field bg-card px-4 text-sm" />
              {stakeTooBig && <p className="mt-1 text-xs font-semibold text-danger-text">More than your wallet holds ({fmt(state.smusd)} sMUSD).</p>}
              {stakeOverCap && <p className="mt-1 text-xs font-semibold text-danger-text">Compass stakes at most {CAP} sMUSD per transaction on mainnet. Stake less, or use the Mezo app for more.</p>}
              <button type="submit" disabled={busy || !gaugeRead || !stakeWei || stakeTooBig || stakeOverCap} className="mt-2 inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-50">
                Stake
              </button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void unstake();
              }}
            >
              <label htmlFor="unstake" className="mb-1 block text-xs font-semibold">
                Unstake sMUSD
              </label>
              <input id="unstake" inputMode="decimal" value={unstakeAmt} onChange={(e) => setUnstakeAmt(e.target.value)} placeholder="10" disabled={!gaugeRead} aria-invalid={unstakeTooBig} className="block h-11 w-full rounded-full border border-field bg-card px-4 text-sm" />
              {unstakeTooBig && <p className="mt-1 text-xs font-semibold text-danger-text">More than you have staked ({fmt(state.staked!)} sMUSD).</p>}
              <button type="submit" disabled={busy || !gaugeRead || !unstakeWei || unstakeTooBig} className="mt-2 inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-bold disabled:opacity-50">
                Unstake
              </button>
            </form>
          </div>
          <button type="button" onClick={claimMezo} disabled={busy || !gaugeRead || !(Number(state.earnedMezo) > 0)} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-bold disabled:opacity-50">
            Claim MEZO
          </button>
          </fieldset>
        </section>
      )}

      {own && setup && (
        <section aria-labelledby="borrow-h" className="rounded-[20px] border border-line bg-card px-5 py-5">
          <h2 id="borrow-h" className="text-base font-bold">
            Borrow MUSD against BTC, then earn
          </h2>
          {net === "mainnet" && (
            <p className="mt-2 text-sm font-semibold">
              This opens a real trove with real BTC. Below 110% it can be liquidated, and you confirm once more on screen before any wallet prompt.
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
                  Locks <span className="font-semibold text-ink">{formatEther(coll)} BTC</span> ({net} price ${setup.btcUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}) for a 200% ratio (BTC can fall about 45% before Mezo&apos;s 110% liquidation line) · fee {(Number(borrowAmt) * setup.feePct / 100).toFixed(2)} MUSD · {setup.gasComp} MUSD gas deposit, returned when the trove closes · you have {setup.btcBalance.toFixed(5)} BTC
                </p>
              )}
              {shortBtc && (
                <p role="alert" className="text-sm font-semibold text-danger-text">
                  Not enough {net === "mainnet" ? "BTC" : "test BTC"} for this trove. {net === "testnet" && <><Link href="/get-test-musd" className="underline">Get test BTC</Link> or </>}{net === "testnet" ? "borrow less." : "Borrow less."}
                </p>
              )}
              {borrowOverCap && (
                <p role="alert" className="text-sm font-semibold text-danger-text">
                  Compass opens troves of at most {CAP} MUSD on mainnet. Borrow less, or use the Mezo app for more.
                </p>
              )}
              <button type="submit" disabled={busy || !borrowWei || Number(borrowAmt) < minBorrow || shortBtc || borrowOverCap} className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-bold text-on-accent disabled:opacity-50">
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
          <AdviceList advice={advice} targetPct={200} footer="Use the boxes below." />
          {advice.flatMap((a) => a.actions ?? []).length > 0 && (
            <p className="mt-2 text-xs">
              {advice
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
              {topUpHint && <p className="mt-1 text-xs text-ink-muted">{topUpHint}</p>}
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
              {repayHint && <p className="mt-1 text-xs text-ink-muted">{repayHint}</p>}
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
