import { SAMPLES, TESTNET } from "@/lib/chain/addresses";

export const X402_NETWORK = "eip155:31611"; // Mezo testnet
export const PREMIUM_PRICE = "$0.001";
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
