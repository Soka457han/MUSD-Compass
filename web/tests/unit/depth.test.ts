import { describe, expect, it } from "vitest";
import { decodeLiquidityNet, musdSellDepth } from "@/lib/depth";

// Mezo mainnet block 13091949 (docs: wave2c task C brief).
const input = {
  sqrtPriceX96: 79573335341073642032772065894425064n,
  tick: 276410,
  liquidity: 267328822706968402705n,
  tickSpacing: 10,
  liquidityNet: new Map<number, bigint>([
    [276420, -267325478829833716609n],
    [276430, -200999661542595n],
  ]),
};

describe("musdSellDepth", () => {
  it("floor at the tick 276420 price absorbs 121,173.6 MUSD for 120,070.4 mUSDC", () => {
    const d = musdSellDepth(input, 0.990449);
    expect(Math.abs(d.musd - 121173.6)).toBeLessThan(1);
    expect(Math.abs(d.usdc - 120070.4)).toBeLessThan(1);
    expect(d.endPrice).toBeCloseTo(0.990449, 5);
  });
  it("floor 0.99 adds the thin band past tick 276420", () => {
    const d = musdSellDepth(input, 0.99);
    expect(Math.abs(d.musd - 121175.3)).toBeLessThan(1);
    expect(d.endPrice).toBeCloseTo(0.99, 5);
  });
  it("a floor above the current price absorbs nothing", () => {
    expect(musdSellDepth(input, 0.995)).toMatchObject({ musd: 0, usdc: 0 });
  });
});

describe("decodeLiquidityNet", () => {
  const word = (v: bigint) => BigInt.asUintN(256, v).toString(16).padStart(64, "0");
  it("reads word 1 as signed int128 from a 10-word Slipstream return", () => {
    const words = [5n, -267325478829833716609n, 0n, 1n, 2n, 3n, 4n, 5n, 6n, 1n].map(word).join("");
    expect(decodeLiquidityNet("0x" + words)).toBe(-267325478829833716609n);
    expect(decodeLiquidityNet("0x" + [5n, 267231227127070652364n, ...Array(8).fill(0n)].map(word).join(""))).toBe(267231227127070652364n);
  });
  it("rejects a short return", () => {
    expect(() => decodeLiquidityNet("0x")).toThrow();
  });
});
