import { describe, expect, it, vi } from "vitest";
import { parseUnits } from "viem";
import { MAINNET, TESTNET } from "@/lib/chain/addresses";
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
  it("reads the mainnet contracts when asked for mainnet, and testnet by default", async () => {
    const mk = () => ({ readContract: vi.fn<(a: { address: string }) => Promise<bigint>>(async () => 0n), simulateContract: vi.fn<(a: { address: string }) => Promise<{ result: bigint }>>(async () => ({ result: 0n })) });
    const main = mk();
    await readVault(main as never, "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C", null, "mainnet");
    expect(main.readContract.mock.calls.map((c) => c[0].address)).toEqual([MAINNET.musd, MAINNET.musd, MAINNET.smusd]);
    expect(main.simulateContract.mock.calls[0][0].address).toBe(MAINNET.smusd);
    const test = mk();
    await readVault(test as never, "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C", null);
    expect(test.readContract.mock.calls.map((c) => c[0].address)).toEqual([TESTNET.musd, TESTNET.musd, TESTNET.smusd]);
  });
});
