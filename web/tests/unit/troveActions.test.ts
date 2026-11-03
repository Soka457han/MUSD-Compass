import { describe, expect, it, vi } from "vitest";
import { parseEther } from "viem";
import { NETWORKS } from "@/lib/chain/addresses";
import { buildRepayStep, buildTopUpStep } from "@/lib/troveActions";

const account = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C" as const;
const UPPER = "0x1111111111111111111111111111111111111111";
const LOWER = "0x2222222222222222222222222222222222222222";
const e18 = 10n ** 18n;

/** A trove with 0.5 BTC and 20,000 MUSD debt (incl. the 200 gas deposit) at $80,000; the wallet holds 1 BTC and 5,000 MUSD. */
function client(o: { status?: number; musd?: bigint; btc?: bigint } = {}) {
  const readContract = vi.fn(async ({ functionName }: { address: string; functionName: string; args?: unknown[] }) => {
    switch (functionName) {
      case "fetchPrice": return 80_000n * e18;
      case "getTroveStatus": return o.status ?? 1;
      case "getEntireDebtAndColl": return [parseEther("0.5"), 20_000n * e18, 0n, 0n, 0n, 0n];
      case "getCurrentICR": return 2n * e18;
      case "getTroveInterestRate": return 100;
      case "getNominalICR": return 1n;
      case "checkRecoveryMode": return false;
      case "balanceOf": return o.musd ?? 5000n * e18;
      case "minNetDebt": return 1800n * e18;
      case "MUSD_GAS_COMPENSATION": return 200n * e18;
      case "borrowingRate": return 10n ** 15n;
      case "getSize": return 10n;
      case "getApproxHint": return [UPPER, 0n, 1n];
      case "findInsertPosition": return [UPPER, LOWER];
      default: throw new Error(`unexpected ${functionName}`);
    }
  });
  return { readContract, getBalance: vi.fn(async () => o.btc ?? parseEther("1")) };
}

describe("buildTopUpStep", () => {
  it("adds collateral with hints and the BTC as value, on the network asked", async () => {
    const s = await buildTopUpStep(client() as never, "mainnet", account, 0.05);
    expect(s.functionName).toBe("addColl");
    expect(s.address).toBe(NETWORKS.mainnet.borrowerOperations);
    expect(s.network).toBe("mainnet");
    expect(s.args).toEqual([UPPER, LOWER]);
    expect(s.value).toBe(parseEther("0.05"));
  });
  it("refuses zero, an account without a trove, and more BTC than the wallet holds (keeping a little for gas)", async () => {
    await expect(buildTopUpStep(client() as never, "mainnet", account, 0)).rejects.toThrow(/more than zero/);
    await expect(buildTopUpStep(client({ status: 0 }) as never, "mainnet", account, 0.05)).rejects.toThrow(/no open trove/);
    await expect(buildTopUpStep(client({ btc: parseEther("0.05") }) as never, "mainnet", account, 0.05)).rejects.toThrow(/BTC for gas/);
  });
});

describe("buildRepayStep", () => {
  it("repays MUSD with hints; no approval step, because BorrowerOperations burns the MUSD itself", async () => {
    const s = await buildRepayStep(client() as never, "testnet", account, 2000);
    expect(s.functionName).toBe("repayMUSD");
    expect(s.address).toBe(NETWORKS.testnet.borrowerOperations);
    expect(s.args).toEqual([2000n * e18, UPPER, LOWER]);
    expect(s.value).toBeUndefined();
  });
  it("refuses zero, more than the wallet holds, a repay that breaks the minimum debt, and an account without a trove", async () => {
    await expect(buildRepayStep(client() as never, "testnet", account, 0)).rejects.toThrow(/more than zero/);
    await expect(buildRepayStep(client({ musd: 100n * e18 }) as never, "testnet", account, 2000)).rejects.toThrow(/only holds 100 MUSD/);
    await expect(buildRepayStep(client({ musd: 50_000n * e18 }) as never, "testnet", account, 19_000)).rejects.toThrow(/under Mezo's minimum/);
    await expect(buildRepayStep(client({ status: 0 }) as never, "testnet", account, 10)).rejects.toThrow(/no open trove/);
  });
});
