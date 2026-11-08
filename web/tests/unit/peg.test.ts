import { describe, expect, it } from "vitest";
import { musdPriceFromSqrtPriceX96 } from "@/lib/sources/peg";
import { fixtureSources } from "@/lib/sources/fixture";
import { buildYields } from "@/lib/yields";

describe("peg", () => {
  it("recorded pool state gives $0.9913", () => {
    expect(musdPriceFromSqrtPriceX96(79573356042004189394853931856270274n)).toBeCloseTo(0.9913, 4);
  });
  it("1 MUSD = 1 mUSDC gives 1", () => {
    expect(musdPriceFromSqrtPriceX96(79228162514264337593543950336n * 10n ** 6n)).toBeCloseTo(1, 8);
  });
  it("buildYields passes the peg through", () => {
    const s = fixtureSources();
    expect(buildYields(s, { amount: 2000, mode: "holder", trove: "new", days: 90, ratePct: null }).assumptions.peg).toBe(s.peg);
    expect(buildYields({ ...s, peg: null }, { amount: 2000, mode: "holder", trove: "new", days: 90, ratePct: null }).assumptions.peg).toBeNull();
  });
});
