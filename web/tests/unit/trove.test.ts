import { describe, expect, it, vi } from "vitest";
import { NETWORKS } from "@/lib/chain/addresses";
import { readTrove, redemptionPosition, safeExtraBorrow } from "@/lib/trove";

describe("readTrove by network", () => {
  const e18 = 10n ** 18n;
  const client = () => ({
    readContract: vi.fn(async ({ functionName }: { address: string; functionName: string }) => {
      switch (functionName) {
        case "fetchPrice": return 80_000n * e18;
        case "getTroveStatus": return 1;
        case "getEntireDebtAndColl": return [1n * e18, 2000n * e18, 0n, 0n, 0n, 0n];
        case "getCurrentICR": return 4n * e18;
        case "getTroveInterestRate": return 100;
        case "getNominalICR": return 5n * 10n ** 16n;
        case "checkRecoveryMode": return false;
        default: throw new Error(`unexpected ${functionName}`);
      }
    }),
  });
  const owner = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C";
  const usedBy = (c: ReturnType<typeof client>) => new Set(c.readContract.mock.calls.map(([a]) => (a as { address: string }).address));

  it("reads the contracts of the network it is asked about, and mainnet by default", async () => {
    const t = client();
    await readTrove(t as never, owner, 0.1, null, "testnet");
    expect(usedBy(t)).toEqual(new Set([NETWORKS.testnet.troveManager, NETWORKS.testnet.priceFeed]));
    const m = client();
    await readTrove(m as never, owner, 0.1, null);
    expect(usedBy(m)).toEqual(new Set([NETWORKS.mainnet.troveManager, NETWORKS.mainnet.priceFeed]));
  });
});

describe("safeExtraBorrow", () => {
  it("keeps ICR at 200 % after the 0.1 % fee is added to the debt", () => {
    const extra = safeExtraBorrow(100_000, 30_000, 0.1);
    expect(extra).toBeCloseTo(19_980.02, 2);
    expect(100_000 / (30_000 + extra * 1.001)).toBeCloseTo(2, 10);
  });
  it("is 0 when the trove is already below the floor", () => {
    expect(safeExtraBorrow(50_000, 30_000, 0.1)).toBe(0);
  });
});

describe("redemptionPosition", () => {
  it("counts troves with a lower nominal ratio (they are redeemed first)", () => {
    expect(redemptionPosition([5n, 1n, 9n, 3n], 4n)).toBe(2);
    expect(redemptionPosition([5n, 9n], 1n)).toBe(0);
  });
});
