import { formatUnits, type Address, type PublicClient } from "viem";
import { smusdAbi, vaultGaugeAbi } from "@/lib/chain/abis";
import { NETWORKS } from "@/lib/chain/addresses";
import type { BorrowEarnStep } from "@/lib/borrowEarn";
import { MAINNET_CAP_MUSD } from "@/lib/sendSafely";

// Staking sMUSD in Mezo's gauge earns MEZO. Mainnet only: no testnet gauge is known.
const net = NETWORKS.mainnet;
const gauge = { address: net.smusdGauge, abi: vaultGaugeAbi } as const;
const exact = (wei: bigint) => formatUnits(wei, 18);
const fmt = (wei: bigint) => Number(formatUnits(wei, 18)).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** The account's sMUSD staked in the gauge and the MEZO it has earned, both 18 decimals, as decimal strings. */
export async function readGaugePosition(client: PublicClient, account: Address): Promise<{ staked: string; earnedMezo: string }> {
  const [staked, earned] = await Promise.all([
    client.readContract({ ...gauge, functionName: "balanceOf", args: [account] }),
    client.readContract({ ...gauge, functionName: "earned", args: [account] }),
  ]);
  return { staked: exact(staked), earnedMezo: exact(earned) };
}

/** Approve the gauge for exactly the amount (unless already allowed), then stake it. deposit pulls the sMUSD with transferFrom. */
export async function buildStakeSteps(client: PublicClient, account: Address, amount: bigint): Promise<BorrowEarnStep[]> {
  if (!(amount > 0n)) throw new Error("Stake more than zero sMUSD.");
  // The guard refuses this too; saying it here stops the plan before the confirm dialog.
  if (amount > BigInt(MAINNET_CAP_MUSD) * 10n ** 18n) throw new Error(`Compass stakes at most ${MAINNET_CAP_MUSD.toLocaleString("en-US")} sMUSD per transaction on mainnet for now.`);
  const [held, allowance] = await Promise.all([
    client.readContract({ address: net.smusd, abi: smusdAbi, functionName: "balanceOf", args: [account] }),
    client.readContract({ address: net.smusd, abi: smusdAbi, functionName: "allowance", args: [account, net.smusdGauge] }),
  ]);
  if (held < amount) throw new Error(`This wallet only holds ${fmt(held)} sMUSD.`);
  return [
    ...(allowance < amount
      ? [{ label: `Approve exactly ${exact(amount)} sMUSD for the gauge`, network: "mainnet" as const, address: net.smusd, abi: smusdAbi, functionName: "approve", args: [net.smusdGauge, amount] }]
      : []),
    { label: `Stake ${exact(amount)} sMUSD in the gauge`, network: "mainnet", ...gauge, functionName: "deposit", args: [amount] },
  ];
}

/** Take staked sMUSD back out of the gauge. */
export async function buildUnstakeStep(client: PublicClient, account: Address, amount: bigint): Promise<BorrowEarnStep> {
  if (!(amount > 0n)) throw new Error("Unstake more than zero sMUSD.");
  const staked = await client.readContract({ ...gauge, functionName: "balanceOf", args: [account] });
  if (amount > staked) throw new Error(`This wallet has only ${fmt(staked)} sMUSD staked.`);
  return { label: `Unstake ${exact(amount)} sMUSD from the gauge`, network: "mainnet", ...gauge, functionName: "withdraw", args: [amount] };
}

/** Claim the account's MEZO. The gauge only pays getReward(account) when the caller is that account. */
export const buildClaimMezoStep = (account: Address): BorrowEarnStep => ({ label: "Claim MEZO", network: "mainnet", ...gauge, functionName: "getReward", args: [account] });
