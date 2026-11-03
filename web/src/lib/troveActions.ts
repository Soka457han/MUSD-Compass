import { formatEther, formatUnits, parseEther, type Address, type PublicClient } from "viem";
import { borrowerOperationsAbi, erc20Abi } from "@/lib/chain/abis";
import { NETWORKS, type NetworkId } from "@/lib/chain/addresses";
import type { BorrowEarnStep } from "@/lib/borrowEarn";
import { getTroveHints } from "@/lib/hints";
import { readTrove } from "@/lib/trove";

const fmt = (wei: bigint) => Number(formatUnits(wei, 18)).toLocaleString("en-US", { maximumFractionDigits: 2 });

async function openTrove(client: PublicClient, network: NetworkId, account: Address) {
  const t = await readTrove(client, account, 0, null, network);
  if (!t.active) throw new Error(`This account has no open trove on Mezo ${network}.`);
  return t;
}

/** Add BTC to the caller's own trove. BorrowerOperations always acts on msg.sender's trove, so this can never touch anyone else's. */
export async function buildTopUpStep(client: PublicClient, network: NetworkId, account: Address, btc: number): Promise<BorrowEarnStep> {
  if (!(btc > 0)) throw new Error("Add more than zero BTC.");
  const t = await openTrove(client, network, account);
  const wei = parseEther(btc.toFixed(8));
  const balance = Number(formatEther(await client.getBalance({ address: account })));
  if (btc + 0.0001 > balance) throw new Error(`Leave a little BTC for gas: this wallet holds ${balance.toFixed(5)} BTC.`);
  const hints = await getTroveHints(client, network, { debt: parseEther(t.debt.toFixed(8)), collateral: parseEther((t.collateralBtc + btc).toFixed(8)) });
  return { label: `Add ${btc} BTC to your trove`, network, address: NETWORKS[network].borrowerOperations, abi: borrowerOperationsAbi, functionName: "addColl", args: [hints.upper, hints.lower], value: wei };
}

/** Repay MUSD on the caller's own trove. No approval: BorrowerOperations burns the MUSD from the caller itself. */
export async function buildRepayStep(client: PublicClient, network: NetworkId, account: Address, musd: number): Promise<BorrowEarnStep> {
  if (!(musd > 0)) throw new Error("Repay more than zero MUSD.");
  const net = NETWORKS[network];
  const t = await openTrove(client, network, account);
  const wei = parseEther(musd.toFixed(8));
  const held = await client.readContract({ address: net.musd, abi: erc20Abi, functionName: "balanceOf", args: [account] });
  if (held < wei) throw new Error(`This wallet only holds ${fmt(held)} MUSD.`);
  const bo = { address: net.borrowerOperations, abi: borrowerOperationsAbi } as const;
  const [minNet, gasComp] = await Promise.all([
    client.readContract({ ...bo, functionName: "minNetDebt" }),
    client.readContract({ ...bo, functionName: "MUSD_GAS_COMPENSATION" }),
  ]);
  const netAfter = t.debt - Number(formatUnits(gasComp, 18)) - musd;
  if (netAfter < Number(formatUnits(minNet, 18))) throw new Error(`Repaying that much would leave the debt under Mezo's minimum of ${fmt(minNet)} MUSD. Repay less.`);
  const hints = await getTroveHints(client, network, { debt: parseEther((t.debt - musd).toFixed(8)), collateral: parseEther(t.collateralBtc.toFixed(8)) });
  return { label: `Repay ${musd} MUSD`, network, address: net.borrowerOperations, abi: borrowerOperationsAbi, functionName: "repayMUSD", args: [wei, hints.upper, hints.lower] };
}
