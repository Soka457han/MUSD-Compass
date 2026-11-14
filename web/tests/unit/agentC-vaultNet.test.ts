import { describe, expect, it } from "vitest";
import { guard, netFromSearch } from "@/lib/sendSafely";

describe("netFromSearch", () => {
  it("reads ?net=mainnet in any letter case, only where mainnet is switched on", () => {
    for (const q of ["?net=mainnet", "?net=MAINNET", "?action=deposit&net=Mainnet&amount=5"]) expect(netFromSearch(q, true)).toBe("mainnet");
    expect(netFromSearch("?net=mainnet", false)).toBe("testnet");
  });
  it("defaults to testnet", () => {
    for (const q of ["", "?net=testnet", "?net=ethereum", "?net="]) expect(netFromSearch(q, true)).toBe("testnet");
  });
});

describe("unknown-contract refusal names the chosen network", () => {
  const dead = { address: "0x000000000000000000000000000000000000dEaD", functionName: "transfer", args: [] } as const;
  it("mainnet lists the gauge, testnet does not", () => {
    expect(() => guard({ ...dead, network: "mainnet" }, { mainnetEnabled: true })).toThrow("Compass only sends to mainnet MUSD, sMUSD, the sMUSD gauge and BorrowerOperations.");
    expect(() => guard({ ...dead, network: "testnet" })).toThrow("Compass only sends to testnet MUSD, sMUSD and BorrowerOperations.");
  });
});
