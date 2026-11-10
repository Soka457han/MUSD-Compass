import { formatUnits, isAddress, type Address, type PublicClient } from "viem";
import { erc20Abi, smusdAbi } from "@/lib/chain/abis";
import { NETWORKS, type NetworkId } from "@/lib/chain/addresses";

export type VaultState = {
  /** True when the 14-day distribution scan was still running; lastDistribution is then null, not "none". */
  lastDistributionPending?: boolean;
  address: Address;
  musd: string; // wallet MUSD, decimal string
  allowance: string; // MUSD the vault may pull
  smusd: string; // deposited (1 sMUSD = 1 MUSD)
  pendingYield: string; // what claimYield would pay now
  lastDistribution: number | null; // unix seconds
};

export const isWallet = (a: string): a is Address => isAddress(a, { strict: false });

/** Per-request reads for one address on one Mezo network (the client must be on that network). Pending yield = simulated claimYield (claimableYield() returns 0). */
export async function readVault(client: PublicClient, address: Address, lastDistribution: number | null, network: NetworkId = "testnet"): Promise<VaultState> {
  const net = NETWORKS[network];
  const [musd, allowance, smusd, pending] = await Promise.all([
    client.readContract({ address: net.musd, abi: erc20Abi, functionName: "balanceOf", args: [address] }),
    client.readContract({ address: net.musd, abi: erc20Abi, functionName: "allowance", args: [address, net.smusd] }),
    client.readContract({ address: net.smusd, abi: smusdAbi, functionName: "balanceOf", args: [address] }),
    client.simulateContract({ account: address, address: net.smusd, abi: smusdAbi, functionName: "claimYield" }).then((r) => r.result),
  ]);
  const f = (v: bigint) => formatUnits(v, 18);
  return { address, musd: f(musd), allowance: f(allowance), smusd: f(smusd), pendingYield: f(pending), lastDistribution };
}
