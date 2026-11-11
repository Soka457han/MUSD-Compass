import { describe, expect, it, vi } from "vitest";
import { erc20Abi, smusdAbi, vaultGaugeAbi } from "@/lib/chain/abis";
import { MAINNET, NETWORKS, TESTNET } from "@/lib/chain/addresses";
import { maxUint256 } from "viem";
import { gasWithBuffer, guard, MAINNET_CAP_MUSD, mainnetWritesEnabled, sendSafely } from "@/lib/sendSafely";

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
    expect(() => guard({ address: TESTNET.musd, functionName: "approve", args: [MAINNET.smusd, 1n], network: "mainnet", walletChainId: 31612 }, mainnetOn)).toThrow(/only sends to mainnet MUSD, sMUSD, the sMUSD gauge and BorrowerOperations/);
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

describe("guard: mainnet cap and amounts", () => {
  const mainnetOn = { mainnetEnabled: true };
  const cap = BigInt(MAINNET_CAP_MUSD) * 10n ** 18n;
  const on = (network: "testnet" | "mainnet", address: string, functionName: string, args: unknown[]) => ({ address: address as `0x${string}`, functionName, args, network, walletChainId: NETWORKS[network].chainId });

  it("the cap is 2,500 MUSD", () => {
    expect(MAINNET_CAP_MUSD).toBe(2_500);
  });
  it("lets a mainnet deposit, approval and new-trove debt through at the cap, and refuses one wei more", () => {
    const calls = [
      (v: bigint) => on("mainnet", MAINNET.smusd, "deposit", [v]),
      (v: bigint) => on("mainnet", MAINNET.musd, "approve", [MAINNET.smusd, v]),
      (v: bigint) => on("mainnet", MAINNET.borrowerOperations, "openTrove", [v, account, account]),
    ];
    for (const c of calls) {
      expect(() => guard(c(cap), mainnetOn)).not.toThrow();
      expect(() => guard(c(cap + 1n), mainnetOn)).toThrow(/at most 2,500 MUSD/);
    }
  });
  it("does not cap testnet, or the mainnet actions that lower risk or return funds", () => {
    const big = 1_000_000n * 10n ** 18n;
    expect(() => guard(on("testnet", TESTNET.smusd, "deposit", [big]))).not.toThrow();
    expect(() => guard(on("testnet", TESTNET.borrowerOperations, "openTrove", [big, account, account]))).not.toThrow();
    expect(() => guard(on("mainnet", MAINNET.smusd, "withdraw", [big]), mainnetOn)).not.toThrow();
    expect(() => guard(on("mainnet", MAINNET.borrowerOperations, "repayMUSD", [big, account, account]), mainnetOn)).not.toThrow();
  });
  it("refuses a deposit, withdrawal or new-trove debt that is zero, negative or not a bigint, on both networks", () => {
    for (const [network, net, opts] of [["testnet", TESTNET, undefined], ["mainnet", MAINNET, mainnetOn]] as const) {
      for (const bad of [0n, -1n, "5", 5, undefined]) {
        expect(() => guard(on(network, net.smusd, "deposit", [bad]), opts)).toThrow(/more than zero/);
        expect(() => guard(on(network, net.smusd, "withdraw", [bad]), opts)).toThrow(/more than zero/);
        expect(() => guard(on(network, net.borrowerOperations, "openTrove", [bad, account, account]), opts)).toThrow(/more than zero/);
      }
    }
  });
  it("refuses an approval amount that is not a bigint above zero", () => {
    for (const bad of [0n, "100", 100, undefined]) {
      expect(() => guard(on("mainnet", MAINNET.musd, "approve", [MAINNET.smusd, bad]), mainnetOn)).toThrow(/more than zero/);
    }
  });
  it("the cap cannot be skipped through sendSafely: nothing is simulated or sent", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAINNET_WRITES", "1");
    const { publicClient, walletClient } = clients();
    await expect(
      sendSafely({ publicClient, walletClient, account, address: MAINNET.smusd, abi: smusdAbi, functionName: "deposit", args: [cap + 1n], network: "mainnet", walletChainId: 31612 } as never),
    ).rejects.toThrow(/at most 2,500 MUSD/);
    expect(publicClient.simulateContract).not.toHaveBeenCalled();
    expect(walletClient.writeContract).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

describe("guard: the whole mainnet surface, tried one call at a time", () => {
  const mainnetOn = { mainnetEnabled: true };
  const stranger = "0x000000000000000000000000000000000000dEaD";
  const one = 10n ** 18n;
  const contracts = { musd: MAINNET.musd, smusd: MAINNET.smusd, borrowerOperations: MAINNET.borrowerOperations, troveManager: MAINNET.troveManager, stabilityPool: MAINNET.stabilityPool, gauge: MAINNET.smusdGauge, ditto: MAINNET.dittoMusdVault, stranger };
  const functions = ["approve", "transfer", "transferFrom", "permit", "increaseAllowance", "mint", "burn", "deposit", "withdraw", "claimYield", "redeem", "openTrove", "addColl", "repayMUSD", "closeTrove", "adjustTrove", "withdrawColl", "withdrawMUSD", "refinance", "redeemCollateral", "provideToSP", "liquidate", "multicall", "upgradeTo", "transferOwnership", "getReward", "notifyRewardAmount", "depositFor", "withdrawAll"];
  // The only calls Compass may make, each with arguments shaped the way the page builds them.
  const allowedArgs: Record<string, unknown[]> = {
    "musd.approve": [MAINNET.smusd, one],
    "smusd.approve": [MAINNET.smusdGauge, one],
    "gauge.deposit": [one],
    "gauge.withdraw": [one],
    "gauge.getReward": [account],
    "smusd.deposit": [one],
    "smusd.withdraw": [one],
    "smusd.claimYield": [],
    "borrowerOperations.openTrove": [2000n * one, account, account],
    "borrowerOperations.addColl": [account, account],
    "borrowerOperations.repayMUSD": [one, account, account],
  };

  it("passes exactly eleven contract and function pairs out of every combination, and refuses the rest", () => {
    const passed: string[] = [];
    for (const [name, address] of Object.entries(contracts)) {
      for (const fn of functions) {
        const key = `${name}.${fn}`;
        for (const args of [allowedArgs[key] ?? [], [stranger, one], [MAINNET.smusd, one], [MAINNET.smusdGauge, one], [one], [account], [one, stranger, stranger], [stranger, stranger]]) {
          try {
            guard({ address: address as `0x${string}`, functionName: fn, args, network: "mainnet", walletChainId: 31612, account }, mainnetOn);
            if (!passed.includes(key)) passed.push(key);
          } catch {
            // refused, as it should be for everything outside the list
          }
        }
      }
    }
    expect(passed.sort()).toEqual(Object.keys(allowedArgs).sort());
    expect(passed).toHaveLength(11);
  });
  it("never lets MUSD be approved for anyone but the vault, whatever else is in the call", () => {
    for (const spender of [stranger, account, MAINNET.borrowerOperations, MAINNET.musd, MAINNET.smusdGauge, TESTNET.smusd, "", undefined, MAINNET.smusd + "00"]) {
      expect(() => guard({ address: MAINNET.musd, functionName: "approve", args: [spender, one], network: "mainnet", walletChainId: 31612 }, mainnetOn)).toThrow();
    }
  });
  it("refuses a mainnet call from a wallet on any other chain, Ethereum included (MUSD has the same address there)", () => {
    for (const chain of [1, 31611, 8453, 56, 0]) {
      expect(() => guard({ address: MAINNET.musd, functionName: "approve", args: [MAINNET.smusd, one], network: "mainnet", walletChainId: chain }, mainnetOn)).toThrow(/needs 31612/);
    }
  });
});

describe("guard: the sMUSD gauge (mainnet only)", () => {
  const mainnetOn = { mainnetEnabled: true };
  const cap = BigInt(MAINNET_CAP_MUSD) * 10n ** 18n;
  const stranger = "0x000000000000000000000000000000000000dEaD";
  const g = (functionName: string, args: unknown[], extra: { account?: `0x${string}` } = {}) => ({ address: MAINNET.smusdGauge as `0x${string}`, functionName, args, network: "mainnet" as const, walletChainId: 31612, ...extra });
  const approveS = (spender: unknown, amount: unknown) => ({ address: MAINNET.smusd, functionName: "approve", args: [spender, amount], network: "mainnet" as const, walletChainId: 31612 });

  it("lets a stake (deposit) through at the cap and refuses one wei more", () => {
    expect(() => guard(g("deposit", [cap]), mainnetOn)).not.toThrow();
    expect(() => guard(g("deposit", [cap + 1n]), mainnetOn)).toThrow(/at most 2,500 MUSD/);
  });
  it("does not cap an unstake (withdraw): it returns funds", () => {
    expect(() => guard(g("withdraw", [1_000_000n * 10n ** 18n]), mainnetOn)).not.toThrow();
  });
  it("refuses a stake or unstake that is zero, negative or not a bigint", () => {
    for (const bad of [0n, -1n, "5", 5, undefined]) {
      expect(() => guard(g("deposit", [bad]), mainnetOn)).toThrow(/more than zero/);
      expect(() => guard(g("withdraw", [bad]), mainnetOn)).toThrow(/more than zero/);
    }
    expect(() => guard(g("deposit", [1n]), mainnetOn)).not.toThrow();
    expect(() => guard(g("withdraw", [1n]), mainnetOn)).not.toThrow();
  });
  it("lets getReward through only for the caller's own account, in any letter case", () => {
    expect(() => guard(g("getReward", [account], { account }), mainnetOn)).not.toThrow();
    expect(() => guard(g("getReward", [account.toLowerCase()], { account }), mainnetOn)).not.toThrow();
    expect(() => guard(g("getReward", [account], { account: account.toLowerCase() as `0x${string}` }), mainnetOn)).not.toThrow();
    expect(() => guard(g("getReward", [stranger], { account }), mainnetOn)).toThrow(/only claims MEZO for your own account/);
    expect(() => guard(g("getReward", [account]), mainnetOn)).toThrow(/only claims MEZO for your own account/);
    for (const bad of ["0xnope", "", 1n, undefined, null]) {
      expect(() => guard(g("getReward", [bad], { account }), mainnetOn)).toThrow(/only claims MEZO for your own account/);
    }
    expect(() => guard(g("getReward", [], { account }), mainnetOn)).toThrow(/only claims MEZO for your own account/);
  });
  it("refuses every other gauge function", () => {
    for (const fn of ["depositFor", "withdrawAll", "notifyRewardAmount", "transfer", "approve", "getRewardFor", "exit"]) {
      expect(() => guard(g(fn, [account, 1n], { account }), mainnetOn)).toThrow(/only stakes, unstakes and claims MEZO/);
    }
  });
  it("refuses every gauge call on testnet: there is no testnet gauge", () => {
    for (const [fn, args] of [["deposit", [1n]], ["withdraw", [1n]], ["getReward", [account]]] as const) {
      expect(() => guard({ address: MAINNET.smusdGauge, functionName: fn, args: [...args], network: "testnet", walletChainId: 31611, account })).toThrow(/only sends to testnet MUSD, sMUSD and BorrowerOperations/);
    }
  });
  it("refuses every gauge call while mainnet is switched off", () => {
    expect(() => guard(g("deposit", [1n]), { mainnetEnabled: false })).toThrow(/switched off/);
  });
  it("lets sMUSD be approved for the gauge at the cap, and refuses one wei more", () => {
    expect(() => guard(approveS(MAINNET.smusdGauge, cap), mainnetOn)).not.toThrow();
    expect(() => guard(approveS(MAINNET.smusdGauge.toUpperCase().replace("0X", "0x"), 1n), mainnetOn)).not.toThrow();
    expect(() => guard(approveS(MAINNET.smusdGauge, cap + 1n), mainnetOn)).toThrow(/at most 2,500 MUSD/);
  });
  it("refuses an sMUSD approval that is zero, negative, not a bigint, or unlimited", () => {
    for (const bad of [0n, -1n, "5", 5, undefined]) {
      expect(() => guard(approveS(MAINNET.smusdGauge, bad), mainnetOn)).toThrow(/more than zero/);
    }
    expect(() => guard(approveS(MAINNET.smusdGauge, maxUint256), mainnetOn)).toThrow(/never asks for an unlimited approval/);
    expect(() => guard(approveS(MAINNET.smusdGauge, maxUint256 / 2n), mainnetOn)).toThrow(/never asks for an unlimited approval/);
  });
  it("refuses an sMUSD approval to anyone but the gauge: the vault, a stranger, MUSD", () => {
    for (const spender of [MAINNET.smusd, stranger, MAINNET.musd, account, MAINNET.borrowerOperations, "", undefined, MAINNET.smusdGauge + "00"]) {
      expect(() => guard(approveS(spender, 1n), mainnetOn)).toThrow(/only approves sMUSD for the sMUSD gauge/);
    }
  });
  it("refuses an sMUSD approval on testnet, even to the mainnet gauge address", () => {
    expect(() => guard({ address: TESTNET.smusd, functionName: "approve", args: [MAINNET.smusdGauge, 1n], network: "testnet", walletChainId: 31611 })).toThrow(/only approves sMUSD for the sMUSD gauge/);
  });
  it("refuses MUSD approved to the gauge", () => {
    expect(() => guard({ address: MAINNET.musd, functionName: "approve", args: [MAINNET.smusdGauge, 1n], network: "mainnet", walletChainId: 31612 }, mainnetOn)).toThrow(/only approves the Savings Vault/);
  });
  it("sendSafely passes its account to the guard: getReward for yourself goes through, for anyone else nothing is simulated", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAINNET_WRITES", "1");
    const ok = clients();
    await sendSafely({ ...ok, account, address: MAINNET.smusdGauge, abi: vaultGaugeAbi, functionName: "getReward", args: [account], network: "mainnet", walletChainId: 31612 } as never);
    expect(ok.walletClient.writeContract).toHaveBeenCalledOnce();
    const bad = clients();
    await expect(
      sendSafely({ ...bad, account, address: MAINNET.smusdGauge, abi: vaultGaugeAbi, functionName: "getReward", args: [stranger], network: "mainnet", walletChainId: 31612 } as never),
    ).rejects.toThrow(/your own account/);
    expect(bad.publicClient.simulateContract).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

describe("review fixes: the chain must be known and a spender must be a string", () => {
  it("sendSafely refuses to send when the wallet's chain is unknown, before any simulation", async () => {
    const { publicClient, walletClient } = clients();
    await expect(sendSafely({ publicClient, walletClient, account, address: TESTNET.smusd, abi: smusdAbi, functionName: "deposit", args: [5n], network: "testnet" } as never)).rejects.toThrow(/could not read which network/);
    expect(publicClient.simulateContract).not.toHaveBeenCalled();
    expect(walletClient.writeContract).not.toHaveBeenCalled();
  });
  it("an approval whose spender is not a string is refused, even if it prints as the vault", () => {
    for (const spender of [[TESTNET.smusd], { toString: () => TESTNET.smusd }, { toLowerCase: () => TESTNET.smusd.toLowerCase() }]) {
      expect(() => guard({ address: TESTNET.musd, functionName: "approve", args: [spender, 1n] })).toThrow(/only approves/);
    }
  });
});
