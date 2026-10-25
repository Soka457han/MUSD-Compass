import { describe, expect, it } from "vitest";
import { TESTNET } from "@/lib/chain/addresses";
import { pickMusdRequirement, PAY_TO } from "@/lib/x402";

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
