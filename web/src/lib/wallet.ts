"use client";
import { createPublicClient, createWalletClient, custom, http, type Address, type EIP1193Provider, type WalletClient } from "viem";
import { mezo, mezoTestnet } from "viem/chains";
import type { NetworkId } from "@/lib/chain/addresses";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export const testnetPublic = createPublicClient({ chain: mezoTestnet, transport: http("https://rpc.test.mezo.org", { batch: { wait: 16 }, retryCount: 5 }) });

// Boar answers browser requests from any origin (CORS preflight checked 3 Nov 2026) and takes JSON-RPC batches.
export const mainnetPublic = createPublicClient({ chain: mezo, transport: http("https://rpc-http.mezo.boar.network", { batch: { wait: 16 }, retryCount: 5 }) });

const chainFor = (network: NetworkId) => (network === "mainnet" ? mezo : mezoTestnet);
export const publicFor = (network: NetworkId) => (network === "mainnet" ? mainnetPublic : testnetPublic);

export const explorerTx = (hash: string, network: NetworkId = "testnet") => `${chainFor(network).blockExplorers.default.url}/tx/${hash}`;

export function injected(): EIP1193Provider | null {
  return typeof window !== "undefined" && window.ethereum ? window.ethereum : null;
}

/** A wallet extension that announced itself (EIP-6963), so several installed wallets can be told apart. */
export type FoundWallet = { uuid: string; name: string; icon: string; rdns: string; provider: EIP1193Provider };

/** Collects EIP-6963 announcements; returns a stop function. Spec: https://eips.ethereum.org/EIPS/eip-6963 */
export function discoverWallets(onFound: (w: FoundWallet) => void): () => void {
  const on = (e: Event) => {
    const d = (e as CustomEvent<{ info: Omit<FoundWallet, "provider">; provider: EIP1193Provider }>).detail;
    if (d?.info?.uuid && d.provider) onFound({ ...d.info, provider: d.provider });
  };
  window.addEventListener("eip6963:announceProvider", on);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  return () => window.removeEventListener("eip6963:announceProvider", on);
}

/** Ask the wallet for an account and make sure it is on the Mezo network of the action (adds the network if the wallet lacks it). */
export async function connect(
  provider: EIP1193Provider | null = injected(),
  network: NetworkId = "testnet",
): Promise<{ wallet: WalletClient; account: Address }> {
  if (!provider) throw new Error("No wallet found in this browser.");
  const chain = chainFor(network);
  const wallet = createWalletClient({ chain, transport: custom(provider) });
  const [account] = await wallet.requestAddresses();
  if ((await wallet.getChainId()) !== chain.id) {
    try {
      await wallet.switchChain({ id: chain.id });
    } catch {
      await wallet.addChain({ chain }); // wallets switch to a chain they just added
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
