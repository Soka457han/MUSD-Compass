import { describe, expect, it } from "vitest";
import { formatEther } from "viem";
import { vi } from "vitest";
import { NETWORKS } from "@/lib/chain/addresses";
import { collateralFor, readBorrowSetup } from "@/lib/borrow";

describe("readBorrowSetup", () => {
  it("reads the contracts of the network it is asked about, testnet by default", async () => {
    const readContract = vi.fn(async ({ functionName }: { address: string; functionName: string }) => (functionName === "getTroveStatus" ? 0 : 10n ** 18n));
    const client = { readContract, getBalance: vi.fn(async () => 10n ** 18n) };
    await readBorrowSetup(client as never, "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C");
    await readBorrowSetup(client as never, "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C", "mainnet");
    const addrs = readContract.mock.calls.map(([a]) => (a as { address: string }).address);
    expect(addrs).toContain(NETWORKS.testnet.borrowerOperations);
    expect(addrs).toContain(NETWORKS.mainnet.borrowerOperations);
    expect(addrs).toContain(NETWORKS.mainnet.troveManager);
  });
});

describe("collateralFor", () => {
  it("locks enough BTC for 200%: (2,000 + 0.1% fee + 200) × 2 ÷ 80,000 = 0.05505 BTC", () => {
    expect(formatEther(collateralFor(2000, { btcUsd: 80_000, feePct: 0.1, gasComp: 200 }))).toBe("0.05505");
  });
  it("rounds up, never down, so the trove never starts under the ratio", () => {
    expect(Number(formatEther(collateralFor(1999.99, { btcUsd: 77_777, feePct: 0.1, gasComp: 200 })))).toBeGreaterThanOrEqual(((1999.99 * 1.001 + 200) * 2) / 77_777);
  });
});
