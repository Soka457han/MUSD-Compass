import { afterEach, describe, expect, it, vi } from "vitest";
import { parseUnits } from "viem";
import { MAINNET, TESTNET } from "@/lib/chain/addresses";
import { isWallet, readVault } from "@/lib/vault";

// The route reads through these clients; each test sets how the fake chain answers.
const chain = vi.hoisted(() => ({ gaugeFails: false, readContract: vi.fn(), simulateContract: vi.fn() }));
vi.mock("@/lib/chain/clients", () => ({ mezoClient: chain, mezoTestnetClient: chain }));
vi.mock("@/lib/sources/smusd", () => ({ fetchSmusdMainnet: async () => ({ lastDistribution: 1792675011 }), fetchSmusdTestnetLastDistribution: async () => 1792675011 }));
vi.mock("next/server", () => ({ after: () => {} }));
import { GET } from "@/app/api/vault/[address]/route";

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

describe("GET /api/vault/{address}", () => {
  const A = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C";
  const get = (network?: string) => GET(new Request(`http://x/api/vault/${A}${network ? `?network=${network}` : ""}`), { params: Promise.resolve({ address: A }) });
  const answer = (o: { gaugeFails?: boolean } = {}) => {
    chain.readContract.mockReset().mockImplementation(async ({ address, functionName }: { address: string; functionName: string }) => {
      if (address.toLowerCase() === MAINNET.smusdGauge.toLowerCase()) {
        if (o.gaugeFails) throw new Error("gauge RPC down");
        return functionName === "earned" ? parseUnits("1.5", 18) : parseUnits("40", 18);
      }
      return parseUnits("10", 18);
    });
    chain.simulateContract.mockReset().mockResolvedValue({ result: 0n });
  };
  afterEach(() => vi.unstubAllEnvs());

  it("adds staked sMUSD and earned MEZO from the gauge on mainnet", async () => {
    answer();
    const r = await get("mainnet");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ smusd: "10", staked: "40", earnedMezo: "1.5", network: "Mezo mainnet" });
  });
  it("a failed gauge read gives null for both and still answers with the vault", async () => {
    answer({ gaugeFails: true });
    const r = await get("mainnet");
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ smusd: "10", staked: null, earnedMezo: null });
  });
  it("testnet has no gauge: the fields are left out and the gauge is never read", async () => {
    answer();
    const body = await (await get()).json();
    expect(body.smusd).toBe("10");
    expect(body).not.toHaveProperty("staked");
    expect(body).not.toHaveProperty("earnedMezo");
    expect(chain.readContract.mock.calls.some((c) => c[0].address.toLowerCase() === MAINNET.smusdGauge.toLowerCase())).toBe(false);
  });
  it("fixtures answer zero staked and earned on mainnet, and leave them out on testnet", async () => {
    vi.stubEnv("COMPASS_FIXTURES", "1");
    expect(await (await get("mainnet")).json()).toMatchObject({ staked: "0", earnedMezo: "0" });
    const test = await (await get("testnet")).json();
    expect(test).not.toHaveProperty("staked");
    expect(test).not.toHaveProperty("earnedMezo");
  });
});
