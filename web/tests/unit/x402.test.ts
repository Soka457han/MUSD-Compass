import { describe, expect, it } from "vitest";
import { MAINNET, TESTNET } from "@/lib/chain/addresses";
import { pickMusdRequirement, PAY_TO, PREMIUM_PRICES, premiumAccepts, X402_NETWORKS } from "@/lib/x402";

const MAINNET_PAYEE = "0xc20f00000000000000000000000000000000aaaa"; // any valid address; the real one is set per deploy

describe("premiumAccepts: the price schedule the 402 response advertises", () => {
  it("has a fixed price per network: 0.001 MUSD on testnet, 0.01 MUSD on mainnet", () => {
    expect(PREMIUM_PRICES).toEqual({ testnet: "$0.001", mainnet: "$0.01" });
    expect(X402_NETWORKS).toEqual({ testnet: "eip155:31611", mainnet: "eip155:31612" });
  });
  it("offers only testnet until a mainnet payee is configured", () => {
    for (const none of [undefined, "", "   "]) {
      expect(premiumAccepts(none)).toEqual([{ scheme: "exact", price: "$0.001", network: "eip155:31611", payTo: PAY_TO }]);
    }
  });
  it("adds the mainnet price, paid to the configured payee, when one is set", () => {
    const accepts = premiumAccepts(MAINNET_PAYEE);
    expect(accepts).toHaveLength(2);
    expect(accepts[1]).toEqual({ scheme: "exact", price: "$0.01", network: "eip155:31612", payTo: MAINNET_PAYEE });
    expect(accepts[0].network).toBe("eip155:31611"); // testnet stays first, so existing clients are unchanged
  });
  it("never advertises a payee that is not a valid address", () => {
    for (const bad of ["0x123", "not an address", "0xZZZ0000000000000000000000000000000000000"]) {
      expect(premiumAccepts(bad).map((a) => a.network)).toEqual(["eip155:31611"]);
    }
  });
});

const ok = { scheme: "exact", network: "eip155:31611", asset: TESTNET.musd, amount: "1000000000000000", payTo: PAY_TO };

describe("pickMusdRequirement (checked before the wallet signs)", () => {
  it("accepts exactly 0.001 testnet MUSD to the Compass payee", () => {
    expect(pickMusdRequirement([ok], PAY_TO)).toBe(ok);
  });
  it.each([
    ["more than 0.001 MUSD", { amount: "1000000000000001" }],
    ["another token", { asset: "0x7b7C000000000000000000000000000000000000" }],
    ["another payee", { payTo: "0x0000000000000000000000000000000000000001" }],
    ["mainnet", { network: "eip155:31612" }],
  ])("refuses %s", (_, change) => {
    expect(() => pickMusdRequirement([{ ...ok, ...change }], PAY_TO)).toThrow(/nothing was signed/);
  });
});

const okMain = { scheme: "exact", network: "eip155:31612", asset: MAINNET.musd, amount: "10000000000000000", payTo: PAY_TO };

describe("pickMusdRequirement on mainnet (real MUSD)", () => {
  it("accepts exactly 0.01 mainnet MUSD to the Compass payee", () => {
    expect(pickMusdRequirement([okMain], PAY_TO, "mainnet")).toBe(okMain);
  });
  it("picks the mainnet offer out of the 402's list of both networks", () => {
    expect(pickMusdRequirement([ok, okMain], PAY_TO, "mainnet")).toBe(okMain);
    expect(pickMusdRequirement([ok, okMain], PAY_TO)).toBe(ok);
  });
  it.each([
    ["more than 0.01 MUSD", { amount: "10000000000000001" }],
    ["testnet MUSD", { asset: TESTNET.musd }],
    ["another token", { asset: "0x7b7C000000000000000000000000000000000000" }],
    ["another payee", { payTo: "0x0000000000000000000000000000000000000001" }],
    ["the testnet network", { network: "eip155:31611" }],
  ])("refuses %s", (_, change) => {
    expect(() => pickMusdRequirement([{ ...okMain, ...change }], PAY_TO, "mainnet")).toThrow(/nothing was signed/);
  });
  it("a testnet button never signs a mainnet offer", () => {
    expect(() => pickMusdRequirement([okMain], PAY_TO)).toThrow(/nothing was signed/);
  });
});
