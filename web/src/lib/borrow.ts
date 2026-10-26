import { formatUnits, parseEther, type Address, type PublicClient } from "viem";
import { borrowerOperationsAbi, priceFeedAbi, troveManagerAbi } from "@/lib/chain/abis";
import { TESTNET } from "@/lib/chain/addresses";
import { SAFE_ICR } from "@/lib/trove";

/** What opening a testnet trove needs, read for one account. */
export type BorrowSetup = { btcUsd: number; minNetDebt: number; feePct: number; gasComp: number; btcBalance: number; hasTrove: boolean };

const f = (v: bigint) => Number(formatUnits(v, 18));

export async function readBorrowSetup(client: PublicClient, account: Address): Promise<BorrowSetup> {
  const bo = { address: TESTNET.borrowerOperations, abi: borrowerOperationsAbi } as const;
  const [price, minNetDebt, rate, gasComp, balance, status] = await Promise.all([
    client.readContract({ address: TESTNET.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" }),
    client.readContract({ ...bo, functionName: "minNetDebt" }),
    client.readContract({ ...bo, functionName: "borrowingRate" }),
    client.readContract({ ...bo, functionName: "MUSD_GAS_COMPENSATION" }),
    client.getBalance({ address: account }),
    client.readContract({ address: TESTNET.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: [account] }),
  ]);
  return { btcUsd: f(price), minNetDebt: f(minNetDebt), feePct: f(rate) * 100, gasComp: f(gasComp), btcBalance: f(balance), hasTrove: status === 1 };
}

/** BTC to lock so the trove starts at the planner's safe ratio: (debt + fee + gas compensation) × 200% ÷ BTC price, rounded up. */
export function collateralFor(debt: number, s: Pick<BorrowSetup, "btcUsd" | "feePct" | "gasComp">, ratio = SAFE_ICR): bigint {
  const btc = ((debt * (1 + s.feePct / 100) + s.gasComp) * ratio) / s.btcUsd;
  return parseEther((Math.ceil(btc * 1e8) / 1e8).toFixed(8));
}
