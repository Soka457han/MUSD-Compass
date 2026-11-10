import { formatEther, formatUnits, parseUnits, type Address, type PublicClient } from "viem";
import { borrowerOperationsAbi, erc20Abi, priceFeedAbi, smusdAbi } from "@/lib/chain/abis";
import { NETWORKS, type NetworkId } from "@/lib/chain/addresses";
import { collateralFor, readBorrowSetup } from "@/lib/borrow";
import { getTroveHints } from "@/lib/hints";
import { MAINNET_CAP_MUSD, type SafeWrite } from "@/lib/sendSafely";
import { SAFE_ICR } from "@/lib/trove";

const f = (v: bigint) => Number(formatUnits(v, 18));
const usd = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The ratio (in %) a new trove starts at: collateral value ÷ (debt + fee + gas compensation). */
export const icrAfterOpen = (collateralBtc: number, debtMusd: number, feePct: number, gasComp: number, btcUsd: number): number =>
  ((collateralBtc * btcUsd) / (debtMusd * (1 + feePct / 100) + gasComp)) * 100;

/** Re-reads the price and fee right before the wallet opens, so a BTC move since the quote cannot start the trove under the floor. */
export async function assertSafeAtSend(client: PublicClient, network: NetworkId, plan: { debt: bigint; collateral: bigint }): Promise<void> {
  const net = NETWORKS[network];
  const bo = { address: net.borrowerOperations, abi: borrowerOperationsAbi } as const;
  const [price, rate, gasComp] = await Promise.all([
    client.readContract({ address: net.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" }),
    client.readContract({ ...bo, functionName: "borrowingRate" }),
    client.readContract({ ...bo, functionName: "MUSD_GAS_COMPENSATION" }),
  ]);
  const icr = icrAfterOpen(f(plan.collateral), f(plan.debt), f(rate) * 100, f(gasComp), f(price));
  if (icr + 1e-6 < SAFE_ICR * 100)
    throw new Error(`BTC moved: this trove would start at ${icr.toFixed(1)}%, below the ${SAFE_ICR * 100}% Compass allows. Nothing was sent.`);
}

/** One wallet action: what sendSafely needs, minus the clients, account and wallet chain the page adds. */
export type BorrowEarnStep = Pick<SafeWrite, "address" | "abi" | "functionName" | "args" | "value" | "network"> & { label: string };

/** Open a trove with hints, approve the vault for exactly the MUSD borrowed (unless already allowed), deposit it. */
export async function buildBorrowEarnSteps(
  client: PublicClient,
  network: NetworkId,
  account: Address,
  debtMusd: number,
): Promise<{ steps: BorrowEarnStep[]; plan: { debt: bigint; collateral: bigint } }> {
  const net = NETWORKS[network];
  if (!(debtMusd > 0)) throw new Error("Borrow more than zero MUSD.");
  // The guard refuses this too; saying it here stops the plan before the confirm dialog.
  if (network === "mainnet" && debtMusd > MAINNET_CAP_MUSD) throw new Error(`Compass opens troves of at most ${usd(MAINNET_CAP_MUSD)} MUSD on mainnet for now. Borrow less, or use the Mezo app.`);
  const setup = await readBorrowSetup(client, account, network);
  if (setup.hasTrove) throw new Error(`This account already has a trove on Mezo ${network}. Compass opens one per account; top it up or repay it instead.`);
  const minDebt = Math.ceil((setup.minNetDebt / (1 + setup.feePct / 100)) * 100) / 100; // the minimum counts the fee
  if (debtMusd < minDebt) throw new Error(`A new trove needs at least ${usd(minDebt)} MUSD of debt (Mezo's ${usd(setup.minNetDebt)} minimum includes the ${setup.feePct}% fee).`);
  const collateral = collateralFor(debtMusd, setup);
  if (Number(formatEther(collateral)) + 0.0001 > setup.btcBalance)
    throw new Error(`This trove needs about ${formatEther(collateral)} BTC to lock, plus a little for gas, and the wallet has ${setup.btcBalance} BTC.`);
  const debt = parseUnits(String(debtMusd), 18);
  // Hints are placed by the ratio the contract will see, which includes the fee and the gas compensation.
  const composite = parseUnits((debtMusd * (1 + setup.feePct / 100) + setup.gasComp).toFixed(8), 18);
  const hints = await getTroveHints(client, network, { debt: composite, collateral });
  const allowance = await client.readContract({ address: net.musd, abi: erc20Abi, functionName: "allowance", args: [account, net.smusd] });
  const steps: BorrowEarnStep[] = [
    { label: `Open a trove: lock ${formatEther(collateral)} BTC, borrow ${debtMusd} MUSD`, network, address: net.borrowerOperations, abi: borrowerOperationsAbi, functionName: "openTrove", args: [debt, hints.upper, hints.lower], value: collateral },
    ...(allowance < debt ? [{ label: `Approve exactly ${debtMusd} MUSD`, network, address: net.musd, abi: erc20Abi, functionName: "approve", args: [net.smusd, debt] }] : []),
    { label: `Deposit ${debtMusd} MUSD`, network, address: net.smusd, abi: smusdAbi, functionName: "deposit", args: [debt] },
  ];
  return { steps, plan: { debt, collateral } };
}

/** The mainnet confirm button stays off until the person types the amount they are borrowing. */
export const amountConfirmed = (typed: string, amount: number): boolean => {
  const n = Number(typed.replace(/[,\s]/g, ""));
  return typed.trim() !== "" && Number.isFinite(n) && n === amount;
};
