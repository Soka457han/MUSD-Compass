import { isAddress, maxUint256, type Abi, type Address, type Hash } from "viem";
import { NETWORKS, type NetworkId } from "@/lib/chain/addresses";

// Compass writes only to these contracts, per network (design §8: refuse unknown contracts). BorrowerOperations only to open a trove.
const allowed = (n: NetworkId) => new Set([NETWORKS[n].musd, NETWORKS[n].smusd, NETWORKS[n].borrowerOperations].map((a) => a.toLowerCase()));

// What Compass may call on BorrowerOperations. Closing, adjusting and withdrawing stay in the Mezo app.
const TROVE_CALLS = new Set(["openTrove", "addColl", "repayMUSD"]);
const VAULT_CALLS = new Set(["deposit", "withdraw", "claimYield"]);

/** Mainnet writes stay off until a deploy sets NEXT_PUBLIC_MAINNET_WRITES=1; testnet is always allowed. */
export const mainnetWritesEnabled = () => process.env.NEXT_PUBLIC_MAINNET_WRITES === "1";

/** The most MUSD one mainnet transaction may deposit, approve or borrow through Compass while it is new. Top-up, repay, withdraw and claim are not capped: they lower risk or return funds. */
export const MAINNET_CAP_MUSD = 2_500;
const overCap = (network: NetworkId, amount: bigint) => network === "mainnet" && amount > BigInt(MAINNET_CAP_MUSD) * 10n ** 18n;
const CAP_TEXT = `Compass moves at most ${MAINNET_CAP_MUSD.toLocaleString("en-US")} MUSD per transaction on Mezo mainnet for now.`;
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

/**
 * The rules every write passes before a wallet is asked: the right chain, known contracts only, and an approval only to the vault, never unlimited.
 * walletChainId is optional here only so the "Try to break it" demos can call guard without a wallet; sendSafely always passes it.
 */
export function guard(
  w: Pick<SafeWrite, "address" | "functionName" | "args"> & Partial<Pick<SafeWrite, "network" | "walletChainId">>,
  opts: { mainnetEnabled: boolean } = { mainnetEnabled: mainnetWritesEnabled() },
): void {
  const network = w.network ?? "testnet";
  const net = NETWORKS[network];
  if (network === "mainnet" && !opts.mainnetEnabled) throw new Error("Mainnet writes are switched off in this deployment. Use Mezo testnet.");
  if (w.walletChainId !== undefined && w.walletChainId !== net.chainId)
    throw new Error(`Your wallet is on chain ${w.walletChainId} but this action needs ${net.chainId} (Mezo ${network}). Switch networks and try again.`);
  if (!allowed(network).has(w.address.toLowerCase())) throw new Error(`Compass only sends to ${network} MUSD, sMUSD and BorrowerOperations.`);
  // Contract by contract, the only functions Compass ever calls. A transfer or a mint on an allowed contract is refused like an unknown contract.
  const to = w.address.toLowerCase();
  if (to === net.musd.toLowerCase() && w.functionName !== "approve") throw new Error("Compass only approves MUSD, and only for the Savings Vault.");
  if (to === net.smusd.toLowerCase()) {
    if (!VAULT_CALLS.has(w.functionName)) throw new Error("Compass only deposits, withdraws and claims yield on the Savings Vault.");
    if (w.functionName !== "claimYield" && !positive(w.args[0])) throw new Error("Compass can only deposit or withdraw more than zero.");
    if (w.functionName === "deposit" && overCap(network, w.args[0] as bigint)) throw new Error(CAP_TEXT);
  }
  if (w.address.toLowerCase() === net.borrowerOperations.toLowerCase()) {
    if (!TROVE_CALLS.has(w.functionName)) throw new Error("Compass only opens a trove, tops it up or repays it on BorrowerOperations; closing or adjusting it is done in the Mezo app.");
    const hints = w.functionName === "openTrove" || w.functionName === "repayMUSD" ? w.args.slice(1) : w.args;
    if (w.functionName === "repayMUSD" && !(typeof w.args[0] === "bigint" && w.args[0] > 0n)) throw new Error("Compass can only repay more than zero MUSD.");
    if (!hints.every((h) => typeof h === "string" && isAddress(h, { strict: false }))) throw new Error("The trove hints must be addresses.");
    if (w.functionName === "openTrove") {
      if (!positive(w.args[0])) throw new Error("Compass can only borrow more than zero MUSD.");
      if (overCap(network, w.args[0])) throw new Error(CAP_TEXT);
    }
  }
  if (w.functionName === "approve") {
    const [spender, amount] = w.args as [string, unknown];
    if (String(spender).toLowerCase() !== net.smusd.toLowerCase()) throw new Error("Compass only approves the Savings Vault to spend MUSD.");
    if (!positive(amount)) throw new Error("Compass can only approve more than zero MUSD.");
    if (amount >= maxUint256 / 2n) throw new Error("Compass never asks for an unlimited approval, only the exact amount you deposit.");
    if (overCap(network, amount)) throw new Error(CAP_TEXT);
  }
}

/** Guard → simulate → estimate × 1.2 → send → wait for the receipt (polled; public RPCs can return null at first). */
export async function sendSafely(w: SafeWrite): Promise<{ hash: Hash }> {
  guard(w);
  const call = { account: w.account, address: w.address, abi: w.abi, functionName: w.functionName, args: w.args, ...(w.value ? { value: w.value } : {}) };
  const { request } = await w.publicClient.simulateContract(call as never);
  const estimate = await w.publicClient.estimateContractGas(call as never);
  const hash = await w.walletClient.writeContract({ ...request, gas: gasWithBuffer(estimate) } as never);
  const receipt = await w.publicClient.waitForTransactionReceipt({ hash, pollingInterval: 1_500, timeout: 120_000, retryCount: 10 } as never);
  if (receipt.status !== "success") throw new Error(`Transaction ${hash} reverted.`);
  return { hash };
}
