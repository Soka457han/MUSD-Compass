import { describe, expect, it } from "vitest";
import { formatEther } from "viem";
import { collateralFor } from "@/lib/borrow";

describe("collateralFor", () => {
  it("locks enough BTC for 200%: (2,000 + 0.1% fee + 200) × 2 ÷ 80,000 = 0.05505 BTC", () => {
    expect(formatEther(collateralFor(2000, { btcUsd: 80_000, feePct: 0.1, gasComp: 200 }))).toBe("0.05505");
  });
  it("rounds up, never down, so the trove never starts under the ratio", () => {
    expect(Number(formatEther(collateralFor(1999.99, { btcUsd: 77_777, feePct: 0.1, gasComp: 200 })))).toBeGreaterThanOrEqual(((1999.99 * 1.001 + 200) * 2) / 77_777);
  });
});
