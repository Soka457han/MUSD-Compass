import { describe, expect, it, vi } from "vitest";
import { erc20Abi, smusdAbi } from "@/lib/chain/abis";
import { TESTNET } from "@/lib/chain/addresses";
import { maxUint256 } from "viem";
import { gasWithBuffer, guard, sendSafely } from "@/lib/sendSafely";

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
      sendSafely({ publicClient, walletClient, account, address: "0x0000000000000000000000000000000000000001", abi: erc20Abi, functionName: "approve", args: [account, 1n] } as never),
    ).rejects.toThrow(/only sends to testnet MUSD, sMUSD and BorrowerOperations/);
    expect(publicClient.simulateContract).not.toHaveBeenCalled();
    expect(walletClient.writeContract).not.toHaveBeenCalled();
  });

  it("simulates, sends with estimate × 1.2, waits for the receipt", async () => {
    const { publicClient, walletClient } = clients();
    const r = await sendSafely({ publicClient, walletClient, account, address: TESTNET.smusd, abi: smusdAbi, functionName: "deposit", args: [5n] } as never);
    expect(publicClient.simulateContract).toHaveBeenCalledOnce();
    expect(walletClient.writeContract).toHaveBeenCalledWith(expect.objectContaining({ gas: 120_000n, functionName: "deposit" }));
    expect(r.hash).toBe("0xabc");
  });

  it("a failed simulation never reaches the wallet, and says why", async () => {
    const { publicClient, walletClient } = clients({ simulateFails: true });
    await expect(
      sendSafely({ publicClient, walletClient, account, address: TESTNET.smusd, abi: smusdAbi, functionName: "withdraw", args: [5n] } as never),
    ).rejects.toThrow(/insufficient balance/);
    expect(walletClient.writeContract).not.toHaveBeenCalled();
  });

  it("a reverted receipt is an error", async () => {
    const { publicClient, walletClient } = clients({ status: "reverted" });
    await expect(
      sendSafely({ publicClient, walletClient, account, address: TESTNET.smusd, abi: smusdAbi, functionName: "claimYield", args: [] } as never),
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

describe("guard: troves", () => {
  it("lets Compass open a testnet trove and nothing else on BorrowerOperations", () => {
    expect(() => guard({ address: TESTNET.borrowerOperations, functionName: "openTrove", args: [2000n, account, account] })).not.toThrow();
    expect(() => guard({ address: TESTNET.borrowerOperations, functionName: "closeTrove", args: [] })).toThrow(/only opens a trove/);
  });
});
