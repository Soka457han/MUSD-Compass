import type { Abi, Address, Hash } from "viem";
import { TESTNET } from "@/lib/chain/addresses";

// Compass writes only to these testnet contracts (design §8: refuse unknown contracts).
const ALLOWED = new Set([TESTNET.musd, TESTNET.smusd].map((a) => a.toLowerCase()));

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
};

/** Allowlist → simulate → estimate × 1.2 → send → wait for the receipt (polled; public RPCs can return null at first). */
export async function sendSafely(w: SafeWrite): Promise<{ hash: Hash }> {
  if (!ALLOWED.has(w.address.toLowerCase())) throw new Error("Compass only sends to testnet MUSD and sMUSD.");
  const call = { account: w.account, address: w.address, abi: w.abi, functionName: w.functionName, args: w.args };
  const { request } = await w.publicClient.simulateContract(call as never);
  const estimate = await w.publicClient.estimateContractGas(call as never);
  const hash = await w.walletClient.writeContract({ ...request, gas: gasWithBuffer(estimate) } as never);
  const receipt = await w.publicClient.waitForTransactionReceipt({ hash, pollingInterval: 1_500, timeout: 120_000, retryCount: 10 } as never);
  if (receipt.status !== "success") throw new Error(`Transaction ${hash} reverted.`);
  return { hash };
}
