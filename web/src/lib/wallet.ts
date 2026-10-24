"use client";
import { createPublicClient, createWalletClient, custom, http, type Address, type EIP1193Provider, type WalletClient } from "viem";
import { mezoTestnet } from "viem/chains";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export const testnetPublic = createPublicClient({ chain: mezoTestnet, transport: http("https://rpc.test.mezo.org", { batch: { wait: 16 }, retryCount: 5 }) });

export const explorerTx = (hash: string) => `${mezoTestnet.blockExplorers.default.url}/tx/${hash}`;

export function injected(): EIP1193Provider | null {
  return typeof window !== "undefined" && window.ethereum ? window.ethereum : null;
}

/** Ask the wallet for an account and make sure it is on Mezo testnet (adds the network if the wallet lacks it). */
export async function connect(): Promise<{ wallet: WalletClient; account: Address }> {
  const provider = injected();
  if (!provider) throw new Error("No wallet found in this browser.");
  const wallet = createWalletClient({ chain: mezoTestnet, transport: custom(provider) });
  const [account] = await wallet.requestAddresses();
  if ((await wallet.getChainId()) !== mezoTestnet.id) {
    try {
      await wallet.switchChain({ id: mezoTestnet.id });
    } catch {
      await wallet.addChain({ chain: mezoTestnet }); // wallets switch to a chain they just added
    }
  }
  return { wallet, account };
}

/** Wallet and RPC errors in words a person can act on. */
export function humanError(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string; code?: number; cause?: { code?: number } };
  const code = err.code ?? err.cause?.code;
  if (code === 4001 || /user rejected|denied/i.test(err.message ?? "")) return "You cancelled in your wallet. Nothing was sent.";
  const text = `${err.shortMessage ?? ""} ${err.message ?? ""}`;
  // OpenZeppelin ERC-20 custom errors (MUSD): selectors of ERC20InsufficientAllowance / ERC20InsufficientBalance.
  if (text.includes("0xfb8f41b2")) return "The vault isn't approved for this amount yet — approve first.";
  if (text.includes("0xe450d38c")) return "Not enough MUSD in this wallet for that amount.";
  return (err.shortMessage ?? err.message ?? "Something went wrong.").split("\n")[0];
}
