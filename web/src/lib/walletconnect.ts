import type { EIP1193Provider } from "viem";
import { NETWORKS } from "@/lib/chain/addresses";

type WalletConnectModule = typeof import("@walletconnect/ethereum-provider");

/** The Reown (WalletConnect) project id. It is public by design: it ships in the browser bundle. */
export const walletConnectProjectId = (): string => process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
export const walletConnectEnabled = (): boolean => walletConnectProjectId() !== "";

/**
 * Opens WalletConnect's QR window and resolves with a provider once a phone wallet has connected.
 * The library is loaded here, on tap, so no page pays for it until someone chooses WalletConnect.
 * Both Mezo chains are optional: a wallet that has never heard of Mezo can still connect, and connect() then asks it to add the chain.
 */
export async function walletConnectProvider(
  projectId: string,
  load: () => Promise<WalletConnectModule> = () => import("@walletconnect/ethereum-provider"),
): Promise<EIP1193Provider> {
  if (!projectId) throw new Error("WalletConnect is not set up on this site yet.");
  let provider;
  try {
    const { EthereumProvider } = await load();
    provider = await EthereumProvider.init({
      projectId,
      optionalChains: [NETWORKS.testnet.chainId, NETWORKS.mainnet.chainId],
      showQrModal: true,
      metadata: { name: "MUSD Compass", description: "Where MUSD earns the most after costs", url: window.location.origin, icons: [`${window.location.origin}/icon-192.png`] },
    });
  } catch {
    throw new Error("Could not start WalletConnect. Check your connection and try again.");
  }
  try {
    await provider.enable();
  } catch {
    throw new Error("The WalletConnect connection was cancelled or timed out. Try again.");
  }
  return provider as unknown as EIP1193Provider;
}
