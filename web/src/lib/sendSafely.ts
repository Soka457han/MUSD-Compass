import { isAddress, maxUint256, type Abi, type Address, type Hash } from "viem";
import { NETWORKS, type NetworkId } from "@/lib/chain/addresses";

// Compass writes only to these contracts, per network (design §8: refuse unknown contracts). BorrowerOperations only to open, top up or repay a trove.
// The sMUSD gauge (stake sMUSD for MEZO) is mainnet only: no testnet gauge is known, so on testnet it is an unknown contract.
const gaugeOf = (n: NetworkId): string | undefined => (n === "mainnet" ? NETWORKS.mainnet.smusdGauge : undefined);
const allowed = (n: NetworkId) =>
  new Set([NETWORKS[n].musd, NETWORKS[n].smusd, NETWORKS[n].borrowerOperations, gaugeOf(n)].flatMap((a) => (a ? [a.toLowerCase()] : [])));

// What Compass may call on BorrowerOperations. Closing, adjusting and withdrawing stay in the Mezo app.
const TROVE_CALLS = new Set(["openTrove", "addColl", "repayMUSD"]);

/** Mainnet writes stay off until a deploy sets NEXT_PUBLIC_MAINNET_WRITES=1; testnet is always allowed. */
export const mainnetWritesEnabled = () => process.env.NEXT_PUBLIC_MAINNET_WRITES === "1";

/** Compass's own launch limit: Mezo's docs and contracts set no maximum (checked 12 Nov 2026, docs/evidence.md). The most MUSD one mainnet transaction may deposit, approve, borrow or stake through Compass while it is new (1 sMUSD counts as 1 MUSD). Top-up, repay, withdraw, unstake and claim are not capped: they lower risk or return funds. */
export const MAINNET_CAP_MUSD = 2_500;
const overCap = (network: NetworkId, amount: bigint) => network === "mainnet" && amount > BigInt(MAINNET_CAP_MUSD) * 10n ** 18n;
const CAP_TEXT = `Compass moves at most ${MAINNET_CAP_MUSD.toLocaleString("en-US")} MUSD per transaction on Mezo mainnet for now. This is Compass's own safety limit; Mezo sets no maximum.`;
const positive = (v: unknown): v is bigint => typeof v === "bigint" && v > 0n;

/** Mezo charges at least half the gas limit, so the buffer stays small: estimate × 1.2, rounded up. */
export const gasWithBuffer = (estimate: bigint) => (estimate * 12n + 9n) / 10n;

type PublicLike = {
  simulateContract: (args: never) => Promise<{ request: Record<string, unknown> }>;
  estimateContractGas: (args: never) => Promise<bigint>;
  waitForTransactionReceipt: (args: never) => Promise<{ status: "success" | "reverted" }>;
};
type WalletLike = { writeContract: (args: never) => Promise<Hash> };

export type SafeWrite = {
  publicClient: PublicLike;
  walletClient: WalletLike;
  account: Address;
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  value?: bigint; // BTC sent with the call (trove collateral)
  network: NetworkId;
  walletChainId: number; // the chain the wallet is on right now; must be the network's chain
};

/** An exact, capped approval to the one spender this token may be approved for (none: refused). */
function checkApproval(network: NetworkId, args: readonly unknown[], spender: string | undefined, wrongSpender: string, token: string): void {
  const [to, amount] = args;
  if (!spender || typeof to !== "string" || to.toLowerCase() !== spender.toLowerCase()) throw new Error(wrongSpender);
  if (!positive(amount)) throw new Error(`Compass can only approve more than zero ${token}.`);
  if (amount >= maxUint256 / 2n) throw new Error("Compass never asks for an unlimited approval, only the exact amount you deposit.");
  if (overCap(network, amount)) throw new Error(CAP_TEXT);
}

/**
 * The rules every write passes before a wallet is asked: the right chain, known contracts only, one explicit rule per contract and function,
 * and approvals only for the exact amount: MUSD to the vault, sMUSD to the gauge (mainnet), never unlimited.
 * walletChainId and account are optional here only so the "Try to break it" demos can call guard without a wallet; sendSafely always passes both.
 * A call without account cannot claim MEZO: getReward must name the caller's own account.
 */
export function guard(
  w: Pick<SafeWrite, "address" | "functionName" | "args"> & Partial<Pick<SafeWrite, "network" | "walletChainId" | "account">>,
  opts: { mainnetEnabled: boolean } = { mainnetEnabled: mainnetWritesEnabled() },
): void {
  const network = w.network ?? "testnet";
  const net = NETWORKS[network];
  if (network === "mainnet" && !opts.mainnetEnabled) throw new Error("Mainnet writes are switched off in this deployment. Use Mezo testnet.");
  if (w.walletChainId !== undefined && w.walletChainId !== net.chainId)
    throw new Error(`Your wallet is on chain ${w.walletChainId} but this action needs ${net.chainId} (Mezo ${network}). Switch networks and try again.`);
  const gauge = gaugeOf(network);
  if (!allowed(network).has(w.address.toLowerCase()))
    throw new Error(`Compass only sends to ${network} MUSD, sMUSD${gauge ? ", the sMUSD gauge" : ""} and BorrowerOperations.`);
  // Contract by contract, the only functions Compass ever calls. Every allowed call returns; anything else throws.
  const to = w.address.toLowerCase();
  const fn = w.functionName;
  const first = w.args[0];
  if (to === net.musd.toLowerCase()) {
    if (fn !== "approve") throw new Error("Compass only approves MUSD, and only for the Savings Vault.");
    return checkApproval(network, w.args, net.smusd, "Compass only approves the Savings Vault to spend MUSD.", "MUSD");
  }
  if (to === net.smusd.toLowerCase()) {
    if (fn === "approve") return checkApproval(network, w.args, gauge, "Compass only approves sMUSD for the sMUSD gauge on Mezo mainnet.", "sMUSD");
    if (fn === "claimYield") return;
    if (fn !== "deposit" && fn !== "withdraw") throw new Error("Compass only deposits, withdraws and claims yield on the Savings Vault.");
    if (!positive(first)) throw new Error("Compass can only deposit or withdraw more than zero.");
    if (fn === "deposit" && overCap(network, first)) throw new Error(CAP_TEXT);
    return;
  }
  if (to === net.borrowerOperations.toLowerCase()) {
    if (!TROVE_CALLS.has(fn)) throw new Error("Compass only opens a trove, tops it up or repays it on BorrowerOperations; closing or adjusting it is done in the Mezo app.");
    const hints = fn === "openTrove" || fn === "repayMUSD" ? w.args.slice(1) : w.args;
    if (fn === "repayMUSD" && !positive(first)) throw new Error("Compass can only repay more than zero MUSD.");
    if (!hints.every((h) => typeof h === "string" && isAddress(h, { strict: false }))) throw new Error("The trove hints must be addresses.");
    if (fn === "openTrove") {
      if (!positive(first)) throw new Error("Compass can only borrow more than zero MUSD.");
      if (overCap(network, first)) throw new Error(CAP_TEXT);
    }
    return;
  }
  if (gauge && to === gauge.toLowerCase()) {
    if (fn === "getReward") {
      // The gauge reverts getReward for anyone but the caller; refusing it here keeps a wrong account from ever reaching the wallet.
      const own = !!w.account && typeof first === "string" && isAddress(first, { strict: false }) && first.toLowerCase() === w.account.toLowerCase();
      if (!own) throw new Error("Compass only claims MEZO for your own account.");
      return;
    }
    if (fn !== "deposit" && fn !== "withdraw") throw new Error("Compass only stakes, unstakes and claims MEZO on the sMUSD gauge.");
    if (!positive(first)) throw new Error("Compass can only stake or unstake more than zero sMUSD.");
    if (fn === "deposit" && overCap(network, first)) throw new Error(CAP_TEXT);
    return;
  }
  throw new Error(`Compass does not send ${fn} to ${w.address}.`); // unreachable while allowed() lists only the contracts above
}

/** Guard → simulate → estimate × 1.2 → send → wait for the receipt (polled; public RPCs can return null at first). */
export async function sendSafely(w: SafeWrite): Promise<{ hash: Hash }> {
  if (typeof w.walletChainId !== "number") throw new Error("Compass could not read which network your wallet is on. Nothing was sent."); // guard skips the chain check without it
  guard(w);
  const call = { account: w.account, address: w.address, abi: w.abi, functionName: w.functionName, args: w.args, ...(w.value ? { value: w.value } : {}) };
  const { request } = await w.publicClient.simulateContract(call as never);
  const estimate = await w.publicClient.estimateContractGas(call as never);
  const hash = await w.walletClient.writeContract({ ...request, gas: gasWithBuffer(estimate) } as never);
  const receipt = await w.publicClient.waitForTransactionReceipt({ hash, pollingInterval: 1_500, timeout: 120_000, retryCount: 10 } as never);
  if (receipt.status !== "success") throw new Error(`Transaction ${hash} reverted.`);
  return { hash };
}
