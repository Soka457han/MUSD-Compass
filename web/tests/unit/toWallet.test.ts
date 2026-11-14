import { describe, expect, it } from "vitest";
import { toWallet } from "@/lib/vault";

describe("toWallet", () => {
  it("accepts any letter case and returns the checksum form (all-caps used to read as an outage)", () => {
    const sum = "0x000000000000000000000000000000000000dEaD";
    expect(toWallet("0x000000000000000000000000000000000000DEAD")).toBe(sum);
    expect(toWallet("0x000000000000000000000000000000000000DeAd")).toBe(sum); // wrong checksum
    expect(toWallet(sum.toLowerCase())).toBe(sum);
  });
  it("still refuses what is not an address", () => {
    for (const bad of ["abc", "0x123", "0x" + "a".repeat(41), "vitalik.eth", ""]) expect(toWallet(bad)).toBeNull();
  });
});
