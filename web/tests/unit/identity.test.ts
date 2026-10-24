import { describe, expect, it } from "vitest";
import { isMezoMusd } from "@/lib/carry/identity";

const MUSD = "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186";
const MUSD_TESTNET = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";

describe("isMezoMusd", () => {
  it("accepts MUSD on Mezo, Ethereum and Base, any letter case", () => {
    expect(isMezoMusd(31612, MUSD)).toBe(true);
    expect(isMezoMusd(1, MUSD.toLowerCase())).toBe(true);
    expect(isMezoMusd(8453, MUSD)).toBe(true);
  });

  it("accepts testnet MUSD only on Mezo testnet", () => {
    expect(isMezoMusd(31611, MUSD_TESTNET)).toBe(true);
    expect(isMezoMusd(31612, MUSD_TESTNET)).toBe(false);
  });

  it("rejects look-alikes: other addresses, or the right address on another chain", () => {
    expect(isMezoMusd(1, "0xacA92E438df0B2401fF60dA7E4337B687a2435DA")).toBe(false); // MetaMask mUSD
    expect(isMezoMusd(143, MUSD)).toBe(false); // Monad: not a Mezo MUSD chain
    expect(isMezoMusd(1, "not-an-address")).toBe(false);
  });
});
