import { formatUnits, isAddress, type Address, type PublicClient } from "viem";
import { erc20Abi, smusdAbi } from "@/lib/chain/abis";
import { TESTNET } from "@/lib/chain/addresses";

export type VaultState = {
  address: Address;
  musd: string; // wallet MUSD, decimal string
  allowance: string; // MUSD the vault may pull
  smusd: string; // deposited (1 sMUSD = 1 MUSD)
  pendingYield: string; // what claimYield would pay now
  lastDistribution: number | null; // unix seconds, testnet
};

export const isWallet = (a: string): a is Address => isAddress(a, { strict: false });

/** Per-request reads for one address on Mezo testnet. Pending yield = simulated claimYield (claimableYield() returns 0). */
export async function readVault(client: PublicClient, address: Address, lastDistribution: number | null): Promise<VaultState> {
  const [musd, allowance, smusd, pending] = await Promise.all([
    client.readContract({ address: TESTNET.musd, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: TESTNET.musd, abi: erc20Abi, functionName: "allowance", args: [address, TESTNET.smusd] }),
    client.readContract({ address: TESTNET.smusd, abi: smusdAbi, functionName: "balanceOf", args: [address] }),
    client.simulateContract({ account: address, address: TESTNET.smusd, abi: smusdAbi, functionName: "claimYield" }).then((r) => r.result),
  ]);
  const f = (v: bigint) => formatUnits(v, 18);
  return { address, musd: f(musd), allowance: f(allowance), smusd: f(smusd), pendingYield: f(pending), lastDistribution };
}
