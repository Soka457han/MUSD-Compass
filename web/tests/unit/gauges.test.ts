import { afterEach, describe, expect, it, vi } from "vitest";
import { parseUnits } from "viem";
import { mezoClient } from "@/lib/chain/clients";
import { MAINNET } from "@/lib/chain/addresses";
import { dittoVenue, gaugeEmissions, mezoVenues, savingsGaugeVenue, readGauge, type GaugeRead, type MezoChain } from "@/lib/sources/mezo";
import { pickMezoPrice } from "@/lib/sources";
import { rescaleLockedApr } from "@/lib/sources/merkl";
import { dilutedApr, venueCarry } from "@/lib/carry/carry";
import type { Venue } from "@/lib/venue";

// Recorded on Mezo mainnet, block 13091751 (8 Nov 2026, 18:01 UTC).
const NOW = Date.parse("2026-11-08T18:01:33Z") / 1000;
const END = Date.parse("2026-11-12T00:00:00Z") / 1000;
const e18 = (s: string) => parseUnits(s, 18);
const btcMusdGauge = (periodFinish = END): GaugeRead => ({
  rewardRate: (e18("16418.973") / 86_400n).toString(), // 16,418.973 MEZO a day
  periodFinish: String(periodFinish),
  staked: e18("97.2942072448957").toString(),
  total: e18("133.68140541524917").toString(),
});

describe("gaugeEmissions", () => {
  it("BTC/MUSD basic pool: about 47.8% at MEZO $0.00425 and TVL $73,240", () => {
    const em = gaugeEmissions(btcMusdGauge(), 73_240, 0.00425, NOW)!;
    expect(em.aprPct).toBeGreaterThan(47.6);
    expect(em.aprPct).toBeLessThan(48);
    expect(em.stakedUsd).toBeCloseTo(73_240 * 0.7278, -1);
    expect(em.mezoPerDay).toBeCloseTo(16_418.973, 2);
  });

  it("concentrated pools use stakedLiquidity / liquidity as the share", () => {
    const g: GaugeRead = { ...btcMusdGauge(), staked: "40987730574247624857499", total: "133281884411186057805834" };
    expect(gaugeEmissions(g, 3_660, 0.00425, NOW)!.stakedUsd).toBeCloseTo(3_660 * (40987.73 / 133281.88), 0);
  });

  it("an ended period, no gauge or nothing staked gives no emissions", () => {
    expect(gaugeEmissions(btcMusdGauge(END), 73_240, 0.00425, END + 1)).toBeNull();
    expect(gaugeEmissions(null, 73_240, 0.00425, NOW)).toBeNull();
    expect(gaugeEmissions({ ...btcMusdGauge(), staked: "0" }, 73_240, 0.00425, NOW)).toBeNull();
    expect(gaugeEmissions(btcMusdGauge(), 73_240, 0, NOW)).toBeNull();
  });
});

const pool = (address: string, name: string, kind: string, gauge: GaugeRead | null) => ({
  address: address as `0x${string}`,
  name,
  kind,
  gauge,
  tokens: [
    { address: MAINNET.btc, reserve: e18("0.45").toString(), decimals: 18 },
    { address: MAINNET.musd, reserve: e18("36000").toString(), decimals: 18 },
  ],
});
const chain = (pools: MezoChain["pools"]): MezoChain => ({
  now: "2026-11-08T18:01:33.000Z", btcPrice: 80_000, borrow: { feePct: 0.1, gasCompensation: 200, minNetDebt: 1800, ratePct: 1 },
  paramsLive: true, spDeposits: 1, gasPriceWei: "1", mezoPoolPriceMusd: 0.00425, pools, savingsGauge: null, dittoAssets: null,
});

describe("mezoVenues with gauges", () => {
  const pools = [
    pool("0x0000000000000000000000000000000000000001", "Mezo pool BTC/MUSD", "Basic volatile", btcMusdGauge()),
    pool("0x0000000000000000000000000000000000000002", "Mezo pool BTC/MUSD-200", "Concentrated volatile", btcMusdGauge()),
    pool("0x0000000000000000000000000000000000000003", "Mezo pool mUSDC/MUSD", "Basic stable", null), // its gauge read failed
  ];
  const v = mezoVenues(chain(pools), 0.00425, undefined, NOW).venues.filter((x) => x.id.startsWith("mezo-pool-"));

  it("a pool with a live gauge carries emissions, diluted by the staked value", () => {
    expect(v[0].rates.emissionsApr).toBeGreaterThan(40);
    expect(v[0].rates.tvl).toBeCloseTo(v[0].tvlUsd! * 0.7278, -1);
    expect(v[0].rates.liquidApr).toBeNull();
    expect(v[0].action.label).toBe("Stake in the Mezo app");
    expect(v[0].notes.join(" ")).toContain("until 12 Nov 2026");
    expect(v[0].notes.join(" ")).not.toContain("in-range");
    expect(v[1].notes.join(" ")).toContain("Only in-range staked liquidity earns");
    const carry = venueCarry(v[0].rates, { amount: 10_000, days: 90, mode: "holder", trove: "existing", ratePct: 1, params: { feePct: 0.1, gasCompensation: 200, minNetDebt: 1800 } });
    expect(carry.liquid).toBeCloseTo(dilutedApr(v[0].rates.emissionsApr!, v[0].rates.tvl, 10_000), 6);
  });

  it("one failed gauge only leaves that pool as a size-only listing", () => {
    expect(v[2].rates.emissionsApr).toBeUndefined();
    expect(v[2].action.label).toBe("See APR in the Mezo app");
    expect(v[1].rates.emissionsApr).toBeGreaterThan(0);
  });

  it("an ended period lists size only", () => {
    const ended = mezoVenues(chain([pools[0]]), 0.00425, undefined, END + 1).venues.find((x) => x.id.startsWith("mezo-pool-"))!;
    expect(ended.rates.emissionsApr).toBeUndefined();
  });

  it("tags a staked value under $10,000 as a small pool", () => {
    expect(v[0].tags).not.toContain("Small pool: the rate drops fast as money comes in");
    const small = mezoVenues(chain([{ ...pools[0], gauge: { ...btcMusdGauge(), staked: "1", total: e18("100").toString() } }]), 0.00425, undefined, NOW).venues.at(-1)!;
    expect(small.rates.emissionsApr).toBeGreaterThan(0);
    expect(small.tags).toContain("Small pool: the rate drops fast as money comes in");
  });
});

describe("readGauge", () => {
  afterEach(() => vi.restoreAllMocks());
  it("returns null, without throwing, when a read fails", async () => {
    vi.spyOn(mezoClient, "readContract").mockRejectedValue(new Error("rpc down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readGauge("0x0000000000000000000000000000000000000001", false)).toBeNull();
  });
  it("returns null for a pool with no gauge", async () => {
    vi.spyOn(mezoClient, "readContract").mockResolvedValue("0x0000000000000000000000000000000000000000");
    expect(await readGauge("0x0000000000000000000000000000000000000001", false)).toBeNull();
  });
});

describe("rescaleLockedApr", () => {
  const venue = (lockedApr: number | null) => ({ rates: { liquidApr: 1, lockedApr, fixedCostUsd: 0, tvl: 1 } }) as Venue;
  it("restates Merkl's veMEZO rate at the price Compass uses", () => {
    const [a, b] = rescaleLockedApr([venue(10), venue(null)], 0.00425, 0.00595);
    expect(a.rates.lockedApr).toBeCloseTo(10 * (0.00425 / 0.00595), 9);
    expect(b.rates.lockedApr).toBeNull();
  });
  it("leaves rates alone when either price is missing or they match", () => {
    const vs = [venue(10)];
    expect(rescaleLockedApr(vs, null, 0.005)).toBe(vs);
    expect(rescaleLockedApr(vs, 0.005, null)).toBe(vs);
    expect(rescaleLockedApr(vs, 0.005, 0.005)).toBe(vs);
  });
});

describe("pickMezoPrice", () => {
  it("pool price first, then Merkl, then nothing", () => {
    expect(pickMezoPrice(0.00425, 0.00595)).toEqual({ price: 0.00425, source: "Mezo MEZO/MUSD pool" });
    expect(pickMezoPrice(null, 0.00595)).toEqual({ price: 0.00595, source: "Merkl" });
    expect(pickMezoPrice(null, null)).toEqual({ price: null, source: null });
  });
});

describe("official vaults beside sMUSD", () => {
  // Live 9 Nov 2026, block 13092373: 71,200.53 MEZO a day to 131,302.52 staked sMUSD until 12 Nov; the Mezo app showed 81.57%.
  const g = { rewardRate: "824080208333333333", periodFinish: "1794441600", staked: "131302520000000000000000" };
  it("staked sMUSD earns the gauge's MEZO and no vault fee yield", () => {
    const v = savingsGaugeVenue(g, 0.00425, "the Mezo MEZO/MUSD pool", 1794200000, "2026-11-09T00:00:00.000Z")!;
    expect(v.rates.emissionsApr).toBeCloseTo(84.1, 0);
    expect(v.rates.liquidApr).toBe(0);
    expect(v.rates.tvl).toBeCloseTo(131_302.52, 2);
  });
  it("no venue once the period ended, with no MEZO price or no read", () => {
    expect(savingsGaugeVenue(g, 0.00425, "x", 1794441601, "")).toBeNull();
    expect(savingsGaugeVenue(g, 0, "x", 1794200000, "")).toBeNull();
    expect(savingsGaugeVenue(null, 0.00425, "x", 1794200000, "")).toBeNull();
  });
  it("Ditto lists size only: its rate is earned on Ethereum", () => {
    const v = dittoVenue(104_230, "2026-11-09T00:00:00.000Z");
    expect(v.rates.liquidApr).toBeNull();
    expect(v.tvlUsd).toBe(104_230);
  });
  it("pools that also need BTC are marked, stable ones are not", () => {
    const all = mezoVenues(chain([pool("0x0000000000000000000000000000000000000001", "Mezo pool BTC/MUSD", "Basic volatile", btcMusdGauge()), pool("0x0000000000000000000000000000000000000003", "Mezo pool mUSDC/MUSD", "Basic stable", null)]), 0.00425, undefined, NOW).venues;
    expect(all.find((x) => x.name === "Mezo pool BTC/MUSD")!.pairToken).toBe("BTC");
    expect(all.find((x) => x.name === "Mezo pool mUSDC/MUSD")!.pairToken).toBeUndefined();
  });
});
