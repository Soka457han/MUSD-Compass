import { describe, expect, it, vi } from "vitest";
import { erc20Abi, smusdAbi } from "@/lib/chain/abis";
import { MAINNET, NETWORKS, TESTNET } from "@/lib/chain/addresses";
import { maxUint256 } from "viem";
import { gasWithBuffer, guard, mainnetWritesEnabled, sendSafely } from "@/lib/sendSafely";

const account = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C" as const;

function clients(opts: { simulateFails?: boolean; status?: "success" | "reverted" } = {}) {
  const publicClient = {
    simulateContract: vi.fn(async (args: object) => {
      if (opts.simulateFails) throw new Error("execution reverted: insufficient balance");
      return { request: { ...args } };
    }),
    estimateContractGas: vi.fn(async () => 100_000n),
    waitForTransactionReceipt: vi.fn(async () => ({ status: opts.status ?? "success", blockNumber: 1n })),
  };
  const walletClient = { writeContract: vi.fn(async () => "0xabc" as `0x${string}`) };
  return { publicClient, walletClient };
}

describe("gasWithBuffer", () => {
  it("adds 20% and rounds up (Mezo charges ≥50% of the limit, so no more than needed)", () => {
    expect(gasWithBuffer(100_000n)).toBe(120_000n);
    expect(gasWithBuffer(1n)).toBe(2n);
  });
});

describe("sendSafely", () => {
  it("refuses any contract other than testnet MUSD and sMUSD, before touching the wallet", async () => {
    const { publicClient, walletClient } = clients();
    await expect(
      sendSafely({ publicClient, walletClient, account, address: "0x0000000000000000000000000000000000000001", abi: erc20Abi, functionName: "approve", args: [account, 1n], network: "testnet", walletChainId: 31611 } as never),
    ).rejects.toThrow(/only sends to testnet MUSD, sMUSD and BorrowerOperations/);
    expect(publicClient.simulateContract).not.toHaveBeenCalled();
    expect(walletClient.writeContract).not.toHaveBeenCalled();
  });

  it("simulates, sends with estimate × 1.2, waits for the receipt", async () => {
    const { publicClient, walletClient } = clients();
    const r = await sendSafely({ publicClient, walletClient, account, address: TESTNET.smusd, abi: smusdAbi, functionName: "deposit", args: [5n], network: "testnet", walletChainId: 31611 } as never);
    expect(publicClient.simulateContract).toHaveBeenCalledOnce();
    expect(walletClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ gas: 120_000n, functionName: "deposit" }));
    expect(r.hash).toBe("0xabc");
  });

  it("a failed simulation never reaches the wallet, and says why", async () => {
    const { publicClient, walletClient } = clients({ simulateFails: true });
    await expect(
      sendSafely({ publicClient, walletClient, account, address: TESTNET.smusd, abi: smusdAbi, functionName: "withdraw", args: [5n], network: "testnet", walletChainId: 31611 } as never),
    ).rejects.toThrow(/insufficient balance/);
    expect(walletClient.writeContract).not.toHaveBeenCalled();
  });

  it("a reverted receipt is an error", async () => {
    const { publicClient, walletClient } = clients({ status: "reverted" });
    await expect(
      sendSafely({ publicClient, walletClient, account, address: TESTNET.smusd, abi: smusdAbi, functionName: "claimYield", args: [], network: "testnet", walletChainId: 31611 } as never),
    ).rejects.toThrow(/reverted/);
  });
});

describe("guard", () => {
  it("allows the exact approval the vault page sends", () => {
    expect(() => guard({ address: TESTNET.musd, functionName: "approve", args: [TESTNET.smusd, 100n * 10n ** 18n] })).not.toThrow();
  });
  it("refuses an unlimited approval and an approval to anyone but the vault", () => {
    expect(() => guard({ address: TESTNET.musd, functionName: "approve", args: [TESTNET.smusd, maxUint256] })).toThrow(/never asks for an unlimited approval/);
    expect(() => guard({ address: TESTNET.musd, functionName: "approve", args: [account, 1n] })).toThrow(/only approves the Savings Vault/);
  });
});

describe("guard: networks", () => {
  const mainnetOn = { mainnetEnabled: true };
  const open = { address: MAINNET.borrowerOperations, functionName: "openTrove", args: [2000n, account, account], network: "mainnet" as const, walletChainId: 31612 };

  it("exposes both networks with their chain ids", () => {
    expect(NETWORKS.testnet.chainId).toBe(31611);
    expect(NETWORKS.mainnet.chainId).toBe(31612);
    expect(NETWORKS.mainnet.smusd).toBe(MAINNET.smusd);
  });
  it("refuses every mainnet write while mainnet is switched off", () => {
    expect(() => guard(open, { mainnetEnabled: false })).toThrow(/Mainnet writes are switched off/);
  });
  it("refuses when the wallet is on a different chain than the action", () => {
    expect(() => guard({ ...open, walletChainId: 31611 }, mainnetOn)).toThrow(/wallet is on chain 31611.*needs 31612/);
    expect(() => guard({ address: TESTNET.smusd, functionName: "deposit", args: [1n], network: "testnet", walletChainId: 31612 })).toThrow(/needs 31611/);
  });
  it("lets Compass open a mainnet trove when mainnet is on, and nothing else on BorrowerOperations", () => {
    expect(() => guard(open, mainnetOn)).not.toThrow();
    expect(() => guard({ ...open, functionName: "closeTrove", args: [] }, mainnetOn)).toThrow(/only opens a trove/);
  });
  it("still refuses an unlimited or misdirected approval on mainnet", () => {
    const approve = { address: MAINNET.musd, functionName: "approve", network: "mainnet" as const, walletChainId: 31612 };
    expect(() => guard({ ...approve, args: [MAINNET.smusd, 100n * 10n ** 18n] }, mainnetOn)).not.toThrow();
    expect(() => guard({ ...approve, args: [MAINNET.smusd, maxUint256] }, mainnetOn)).toThrow(/never asks for an unlimited approval/);
    expect(() => guard({ ...approve, args: [TESTNET.smusd, 1n] }, mainnetOn)).toThrow(/only approves the Savings Vault/);
  });
  it("refuses a testnet contract on mainnet and a mainnet contract on testnet", () => {
    expect(() => guard({ address: TESTNET.musd, functionName: "approve", args: [MAINNET.smusd, 1n], network: "mainnet", walletChainId: 31612 }, mainnetOn)).toThrow(/only sends to mainnet MUSD, sMUSD and BorrowerOperations/);
    expect(() => guard({ address: MAINNET.musd, functionName: "approve", args: [TESTNET.smusd, 1n], network: "testnet", walletChainId: 31611 })).toThrow(/only sends to testnet MUSD, sMUSD and BorrowerOperations/);
  });
});

describe("guard: troves", () => {
  it("lets Compass open a testnet trove and nothing else on BorrowerOperations", () => {
    expect(() => guard({ address: TESTNET.borrowerOperations, functionName: "openTrove", args: [2000n, account, account] })).not.toThrow();
    expect(() => guard({ address: TESTNET.borrowerOperations, functionName: "closeTrove", args: [] })).toThrow(/only opens a trove/);
  });
});

describe("guard: only the functions Compass uses, on every contract", () => {
  const mainnetOn = { mainnetEnabled: true };
  it("refuses a MUSD transfer or any MUSD call that is not an approval, on both networks", () => {
    for (const [network, net, opts] of [["testnet", TESTNET, undefined], ["mainnet", MAINNET, mainnetOn]] as const) {
      const chainId = NETWORKS[network].chainId;
      for (const fn of ["transfer", "transferFrom", "burn", "permit"]) {
        expect(() => guard({ address: net.musd, functionName: fn, args: [account, 1n], network, walletChainId: chainId }, opts)).toThrow(/only approves MUSD/);
      }
    }
  });
  it("refuses anything on the Savings Vault except deposit, withdraw and claimYield", () => {
    for (const fn of ["transfer", "approve", "redeem", "mint", "transferFrom"]) {
      if (fn === "approve") continue; // approve is judged by its own spender rule below
      expect(() => guard({ address: TESTNET.smusd, functionName: fn, args: [account, 1n], network: "testnet", walletChainId: 31611 })).toThrow(/only deposits, withdraws and claims/);
    }
    for (const fn of ["deposit", "withdraw", "claimYield"]) {
      expect(() => guard({ address: TESTNET.smusd, functionName: fn, args: [1n], network: "testnet", walletChainId: 31611 })).not.toThrow();
    }
  });
  it("still allows the exact approval to the vault, so Deposit and Borrow → Earn keep working", () => {
    expect(() => guard({ address: TESTNET.musd, functionName: "approve", args: [TESTNET.smusd, 1n], network: "testnet", walletChainId: 31611 })).not.toThrow();
  });
});

describe("guard: top up and repay", () => {
  const mainnetOn = { mainnetEnabled: true };
  const bo = (functionName: string, args: unknown[], network: "testnet" | "mainnet" = "testnet") => ({
    address: NETWORKS[network].borrowerOperations,
    functionName,
    args,
    network,
    walletChainId: NETWORKS[network].chainId,
  });
  it("lets Compass add collateral to a trove and repay its MUSD", () => {
    expect(() => guard(bo("addColl", [account, account]))).not.toThrow();
    expect(() => guard(bo("repayMUSD", [5n * 10n ** 18n, account, account]))).not.toThrow();
    expect(() => guard(bo("addColl", [account, account], "mainnet"), mainnetOn)).not.toThrow();
  });
  it("still refuses everything else on BorrowerOperations: close, adjust, withdraw, refinance", () => {
    for (const fn of ["closeTrove", "adjustTrove", "withdrawColl", "withdrawMUSD", "refinance"]) {
      expect(() => guard(bo(fn, []))).toThrow(/only opens a trove, tops it up or repays it/);
    }
  });
  it("refuses a repay of zero and a repay amount that is not a number", () => {
    expect(() => guard(bo("repayMUSD", [0n, account, account]))).toThrow(/repay more than zero/);
    expect(() => guard(bo("repayMUSD", ["5", account, account]))).toThrow(/repay more than zero/);
  });
  it("refuses hints that are not addresses", () => {
    expect(() => guard(bo("addColl", ["0xnope", account]))).toThrow(/hint/);
  });
});

describe("mainnetWritesEnabled", () => {
  it("is on only when a deploy sets NEXT_PUBLIC_MAINNET_WRITES=1", () => {
    vi.stubEnv("NEXT_PUBLIC_MAINNET_WRITES", "");
    expect(mainnetWritesEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_MAINNET_WRITES", "true");
    expect(mainnetWritesEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_MAINNET_WRITES", "1");
    expect(mainnetWritesEnabled()).toBe(true);
    vi.unstubAllEnvs();
  });
  it("guard refuses mainnet by default, without the flag", () => {
    vi.stubEnv("NEXT_PUBLIC_MAINNET_WRITES", "");
    expect(() => guard({ address: MAINNET.musd, functionName: "approve", args: [MAINNET.smusd, 1n], network: "mainnet", walletChainId: 31612 })).toThrow(/switched off/);
    vi.unstubAllEnvs();
  });
});
