import { describe, expect, it } from "vitest";
import { createPublicClient, formatEther, http, parseEther, parseUnits, type Address, type PublicClient } from "viem";
import { mezo } from "viem/chains";
import { borrowerOperationsAbi, erc20Abi } from "@/lib/chain/abis";
import { NETWORKS, SAMPLES } from "@/lib/chain/addresses";
import { assertSafeAtSend, buildBorrowEarnSteps } from "@/lib/borrowEarn";
import { guard } from "@/lib/sendSafely";

// Mainnet dry run: runs Compass's own Borrow → Earn code against Mezo mainnet and simulates the trove opening
// with eth_call. Nothing is signed or sent, and no funds are needed: the dummy account is given 1 BTC inside the
// simulation only. Off by default (it needs the network): LIVE_MAINNET=1 npx vitest run tests/live
const live = process.env.LIVE_MAINNET === "1";
const RPC = process.env.MEZO_MAINNET_RPC ?? "https://rpc-http.mezo.boar.network";

// A dummy address with no trove and no funds; the simulation lends it BTC.
const DUMMY: Address = "0x1111111111111111111111111111111111111111";

describe.skipIf(!live)("Mezo mainnet dry run (simulation only)", () => {
  const client = createPublicClient({ chain: mezo, transport: http(RPC, { retryCount: 5 }) }) as PublicClient;
  // buildBorrowEarnSteps checks the wallet holds the BTC it will lock; the dummy holds none, so only that balance read is faked.
  const funded = { readContract: client.readContract.bind(client), getBalance: async () => parseEther("1") } as unknown as PublicClient;

  it("builds the three steps for 2,000 MUSD, they pass the guard on mainnet, and the trove would start at 200% or more", async () => {
    const { steps, plan } = await buildBorrowEarnSteps(funded, "mainnet", DUMMY, 2000);
    expect(steps.map((s) => s.functionName)).toEqual(["openTrove", "approve", "deposit"]);
    for (const s of steps) expect(() => guard({ ...s, walletChainId: 31612 }, { mainnetEnabled: true })).not.toThrow();
    await expect(assertSafeAtSend(client, "mainnet", plan)).resolves.toBeUndefined();
    const [open] = steps;
    const [, upper, lower] = open.args as [bigint, Address, Address];
    console.log(`DRYRUN lock ${formatEther(plan.collateral)} BTC for 2000 MUSD, hints ${upper} / ${lower}`);
    expect(Number(formatEther(plan.collateral))).toBeGreaterThan(0);
  }, 120_000);

  it("openTrove simulates successfully on mainnet with those hints (eth_call, 1 BTC lent to the dummy inside the simulation)", async () => {
    const { steps, plan } = await buildBorrowEarnSteps(funded, "mainnet", DUMMY, 2000);
    const [open] = steps;
    const res = await client.simulateContract({
      account: DUMMY,
      address: NETWORKS.mainnet.borrowerOperations,
      abi: borrowerOperationsAbi,
      functionName: "openTrove",
      args: open.args as never,
      value: plan.collateral,
      stateOverride: [{ address: DUMMY, balance: parseEther("1") }],
    });
    console.log("DRYRUN openTrove simulation ok:", res.request.functionName);
    expect(res.request.functionName).toBe("openTrove");
  }, 120_000);

  it("the same trove with too little BTC is refused by the contract in simulation (the dry run can fail)", async () => {
    const { steps, plan } = await buildBorrowEarnSteps(funded, "mainnet", DUMMY, 2000);
    const thin = plan.collateral / 3n; // a third of the collateral: far under 110%
    await expect(
      client.simulateContract({
        account: DUMMY,
        address: NETWORKS.mainnet.borrowerOperations,
        abi: borrowerOperationsAbi,
        functionName: "openTrove",
        args: steps[0].args as never,
        value: thin,
        stateOverride: [{ address: DUMMY, balance: parseEther("1") }],
      }),
    ).rejects.toThrow();
  }, 120_000);

  it("an exact approval to the mainnet vault simulates from a real MUSD holder (the approve step of the flow)", async () => {
    const holder = SAMPLES.positions as Address;
    const held = await client.readContract({ address: NETWORKS.mainnet.musd, abi: erc20Abi, functionName: "balanceOf", args: [holder] });
    console.log("DRYRUN holder MUSD:", formatEther(held));
    const one = parseUnits("1", 18);
    const res = await client.simulateContract({ account: holder, address: NETWORKS.mainnet.musd, abi: erc20Abi, functionName: "approve", args: [NETWORKS.mainnet.smusd, one] });
    expect(res.request.functionName).toBe("approve");
  }, 120_000);
});
