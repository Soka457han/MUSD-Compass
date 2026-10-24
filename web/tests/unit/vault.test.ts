import { describe, expect, it, vi } from "vitest";
import { parseUnits } from "viem";
import { isWallet, readVault } from "@/lib/vault";

describe("isWallet", () => {
  it("accepts any-case 0x addresses, rejects junk", () => {
    expect(isWallet("0xfe21B2782B35BE770DD4a7b05f81cE43790D676C")).toBe(true);
    expect(isWallet("0xfe21b2782b35be770dd4a7b05f81ce43790d676c")).toBe(true);
    expect(isWallet("0x123")).toBe(false);
    expect(isWallet("vitalik.eth")).toBe(false);
  });
});

describe("readVault", () => {
  it("formats balances and reads pending yield from a simulated claimYield", async () => {
    const reads = [parseUnits("157.31", 18), 0n, parseUnits("100", 18)];
    const client = {
      readContract: vi.fn(async () => reads.shift()),
      simulateContract: vi.fn(async () => ({ result: parseUnits("0.42", 18) })),
    };
    const s = await readVault(client as never, "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C", 1792675011);
    expect(s).toMatchObject({ musd: "157.31", allowance: "0", smusd: "100", pendingYield: "0.42", lastDistribution: 1792675011 });
    expect(client.simulateContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "claimYield", account: "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C" }));
  });
});
