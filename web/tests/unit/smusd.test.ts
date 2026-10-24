import { describe, expect, it } from "vitest";
import fixture from "../fixtures/smusd-yield-events-2026-10-24.json";
import { realisedApr } from "@/lib/sources/smusd";

describe("realisedApr (mainnet sample, 24 Oct 2026)", () => {
  it("14-day window: 11,349 MUSD over 7.38M sMUSD → 4.01%", () => {
    const r = realisedApr(fixture.events, fixture.totalSupply, fixture.headTimestamp);
    expect(r.yieldMusd).toBeCloseTo(11_349.06, 1);
    expect(r.aprPct).toBeCloseTo(4.008, 2);
    expect(r.events).toBe(9);
  });

  it("7-day window matches the design's earlier 4.23%", () => {
    const r = realisedApr(fixture.events, fixture.totalSupply, fixture.headTimestamp, 7);
    expect(r.aprPct).toBeCloseTo(4.232, 2);
  });

  it("reports the latest distribution time", () => {
    const r = realisedApr(fixture.events, fixture.totalSupply, fixture.headTimestamp);
    expect(r.lastDistribution).toBe(1792675011);
  });

  it("zero supply never divides by zero", () => {
    expect(realisedApr(fixture.events, "0", fixture.headTimestamp).aprPct).toBe(0);
  });
});

describe("scanYieldEvents (fake client)", async () => {
  const { scanYieldEvents } = await import("@/lib/sources/smusd");
  it("covers the window in contiguous ≤10k-block ranges and stamps each event", async () => {
    const ranges: [bigint, bigint][] = [];
    const head = 1_000_000n;
    const client = {
      getBlock: async ({ blockNumber }: { blockNumber?: bigint } = {}) => {
        const n = blockNumber ?? head;
        return { number: n, timestamp: n * 4n }; // 4 s per block
      },
      getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
        ranges.push([fromBlock, toBlock]);
        return fromBlock <= 999_000n && 999_000n <= toBlock
          ? [{ eventName: "ProtocolYieldReceived", blockNumber: 999_000n, args: { amount: 5n } }]
          : [];
      },
    };
    const r = await scanYieldEvents(client as never, "0x0000000000000000000000000000000000000001", 1);
    // 1 day at 4 s/block = 21,600 blocks → 3 ranges
    ranges.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    expect(ranges.length).toBe(3);
    for (const [f, t] of ranges) expect(t - f).toBeLessThan(10_000n);
    for (let i = 1; i < ranges.length; i++) expect(ranges[i][0]).toBe(ranges[i - 1][1] + 1n);
    expect(ranges.at(-1)![1]).toBe(head);
    expect(r.events).toEqual([{ kind: "ProtocolYieldReceived", blockNumber: 999000, timestamp: 3996000, amount: "5" }]);
  });
});
