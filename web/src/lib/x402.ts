import { isAddress } from "viem";
import { SAMPLES, TESTNET } from "@/lib/chain/addresses";

export const X402_NETWORKS = { testnet: "eip155:31611", mainnet: "eip155:31612" } as const;
export const X402_NETWORK = X402_NETWORKS.testnet; // the pay button signs on testnet only
/** Price per premium call, in MUSD. Mainnet is ten times testnet: a cent buys the whole bundle for one amount, the six mode and period combinations plus an address's trove and rewards. */
export const PREMIUM_PRICES = { testnet: "$0.001", mainnet: "$0.01" } as const;
export const PREMIUM_PRICE = PREMIUM_PRICES.testnet;
export const PAY_TO = SAMPLES.devWallet; // public dev wallet; the button checks payments go here
export const MAX_ATOMIC = 1_000_000_000_000_000n; // 0.001 MUSD (18 decimals): the most the button ever signs

type Requirement = { scheme: string; network: string; asset: string; amount: string; payTo: string };

/** Client-side guard before signing: only the exact scheme, testnet MUSD, at most 0.001 MUSD, to the expected payee. */
export function pickMusdRequirement<T extends Requirement>(reqs: T[], payTo: string): T {
  const ok = reqs.find(
    (r) =>
      r.scheme === "exact" &&
      r.network === X402_NETWORK &&
      r.asset.toLowerCase() === TESTNET.musd.toLowerCase() &&
      r.payTo.toLowerCase() === payTo.toLowerCase() &&
      BigInt(r.amount) <= MAX_ATOMIC,
  );
  if (!ok) throw new Error("The server asked for a payment Compass doesn't expect, so nothing was signed.");
  return ok;
}

/**
 * What the 402 response offers. Testnet is always first. Mainnet is offered only when a deploy names the wallet that should receive
 * real MUSD (X402_MAINNET_PAY_TO), and only if that is a valid address: a malformed payee is dropped, never advertised.
 */
export type PremiumOption = { scheme: "exact"; price: string; network: `${string}:${string}`; payTo: string };

export function premiumAccepts(mainnetPayTo: string | undefined): PremiumOption[] {
  const accepts: PremiumOption[] = [{ scheme: "exact", price: PREMIUM_PRICES.testnet, network: X402_NETWORKS.testnet, payTo: PAY_TO }];
  const payee = mainnetPayTo?.trim();
  if (payee && isAddress(payee)) accepts.push({ scheme: "exact", price: PREMIUM_PRICES.mainnet, network: X402_NETWORKS.mainnet, payTo: payee });
  return accepts;
}
