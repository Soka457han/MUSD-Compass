import { describe, expect, it } from "vitest";
import { getAddress, isAddress } from "viem";
import { ETHEREUM, MAINNET, SAMPLES, TESTNET } from "@/lib/chain/addresses";

function flatten(o: object): string[] {
  return Object.values(o).flatMap((v) => (typeof v === "string" ? [v] : flatten(v)));
}

describe("addresses", () => {
  it("every address is a valid EVM address", () => {
    for (const a of flatten({ MAINNET, TESTNET, ETHEREUM, SAMPLES })) {
      expect(isAddress(a, { strict: false }), a).toBe(true);
      expect(getAddress(a).toLowerCase()).toBe(a.toLowerCase());
    }
  });

  it("MUSD has the same address on Mezo and Ethereum", () => {
    expect(MAINNET.musd).toBe(ETHEREUM.musd);
  });
});
