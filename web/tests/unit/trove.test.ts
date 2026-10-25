import { describe, expect, it } from "vitest";
import { redemptionPosition, safeExtraBorrow } from "@/lib/trove";

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
