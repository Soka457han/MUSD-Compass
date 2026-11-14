import { describe, expect, it } from "vitest";
import { checkText, mezoOverDepth } from "@/components/PriceLabel";
import { fixtureSources } from "@/lib/sources/fixture";
import { compare, movable, placesFor, type Positions } from "@/lib/positions";
import { gaugeAprPct } from "@/lib/gauge";

const sources = fixtureSources();
const vaultApr = sources.venues.find((v) => v.id === "mezo-smusd")!.rates.liquidApr!;
// The same sources without the staked-sMUSD venue, for the cases where the plain vault is the best place.
const noGauge = { ...sources, venues: sources.venues.filter((v) => v.id !== "mezo-smusd-gauge") };
const base: Positions = { address: "0x0000000000000000000000000000000000000001", wallet: 0, vault: 0, staked: null, stakedApr: null, stability: 0, trove: null, veMezo: null };

describe("compare", () => {
  it("idle MUSD earns 0%: the gap to the best place is the whole best cash rate", () => {
    const [row] = compare({ ...base, wallet: 1000 }, sources);
    expect(row.id).toBe("wallet");
    expect(row.nowPct).toBe(0);
    expect(row.extraPerYear).toBeCloseTo((1000 * row.best.carry.cash!) / 100, 6);
  });
  it("staked in the gauge when the gauge is best: nothing more to gain", () => {
    const gauge = sources.venues.find((v) => v.id === "mezo-smusd-gauge")!;
    const [row] = compare({ ...base, staked: 5000, stakedApr: gauge.rates.emissionsApr! }, sources);
    expect(row.best.id).toBe("mezo-smusd-gauge");
    expect(row.extraPerYear).toBeLessThan(5000 * 0.02); // only the dilution of 5,000 MUSD separates them
  });
  it("already in the vault when the vault is best: nothing more to gain", () => {
    const [row] = compare({ ...base, vault: 2000 }, noGauge);
    expect(row.best.id).toBe("mezo-smusd");
    expect(row.nowPct).toBe(vaultApr);
    expect(row.extraPerYear).toBeCloseTo(0, 6);
  });
  it("Stability Pool has no steady APR, so no yearly gap is claimed; dust under 1 MUSD is skipped", () => {
    const rows = compare({ ...base, stability: 500, wallet: 0.4 }, sources);
    expect(rows.map((r) => r.id)).toEqual(["stability"]);
    expect(rows[0].extraPerYear).toBeNull();
  });
});

describe("checkText", () => {
  it("reads as one sentence a person can act on", () => {
    expect(checkText({ keepMusd: 19.73, oneOffMusd: 0, paybackDays: null }, 90)).toBe("you keep 19.73 MUSD cash, no one-off costs");
    expect(checkText({ keepMusd: -1.2, oneOffMusd: 1.28, paybackDays: "never" }, 90)).toBe("you lose 1.20 MUSD · 1.28 MUSD one-off costs, never earned back at today's yield");
    expect(checkText({ keepMusd: 3, oneOffMusd: 1.28, paybackDays: 120 }, 90)).toBe("you keep 3.00 MUSD cash · 1.28 MUSD one-off costs, earned back after 120 days, longer than your hold");
    expect(checkText({ keepMusd: 3, oneOffMusd: 2, paybackDays: 1 }, 365)).toBe("you keep 3.00 MUSD cash · 2.00 MUSD one-off costs, earned back after 1 day");
  });
  it("MEZO-paid venues say the reward is MEZO, not MUSD cash", () => {
    expect(checkText({ keepMusd: 263.89, oneOffMusd: 0, paybackDays: null }, 90, true)).toBe("you keep about 263.89 MUSD after costs, earned as MEZO, no one-off costs");
  });
});

describe("mezoOverDepth", () => {
  const v = { carry: { liquid: 40, locked: 0, costs: 0, cash: 40, total: 40 }, mezoSellDepthMusd: 824 };
  it("warns only when the MEZO earned over the hold is more than the MEZO pool can pay sellers", () => {
    expect(mezoOverDepth(v, 2000, 90)).toBeNull(); // 197 MUSD of MEZO
    expect(mezoOverDepth(v, 100_000, 90)).toBeCloseTo(9863.01, 1);
    expect(mezoOverDepth({ ...v, mezoSellDepthMusd: undefined }, 100_000, 90)).toBeNull(); // not MEZO-paid
  });
});

describe("compare on several holdings", () => {
  it("compares every movable holding at one shared rate, so the rows agree and add up", () => {
    const p = { ...base, wallet: 467, vault: 57_000 };
    const rows = compare(p, sources);
    expect(movable(p)).toBe(57_467);
    expect(rows[0].best.carry.cash).toBeCloseTo(rows[1].best.carry.cash!, 9);
    expect(rows[0].best.carry.cash).toBeCloseTo(placesFor(57_467, sources).find((v) => v.id === rows[0].best.id)!.carry.cash!, 9);
  });
});

describe("staked sMUSD", () => {
  it("gauge rate: rewardRate × a year × MEZO price ÷ staked (26 Oct live values give the Mezo app's 1.38%)", () => {
    const apr = gaugeAprPct(442519857974567886n, 5_309_027.19, 1793232000n, 1793001797, 0.005276);
    expect(apr).toBeCloseTo(1.387, 2);
    expect(gaugeAprPct(1n, 1, 100n, 200, 1)).toBe(0); // reward period over
  });
  it("staked earns MEZO instead of the savings yield, so unstaking is the better cash place", () => {
    const [row] = compare({ ...base, staked: 10_000, stakedApr: 1.38 }, noGauge);
    expect(row.id).toBe("staked");
    expect(row.best.id).toBe("mezo-smusd");
    expect(row.extraPerYear).toBeCloseTo((10_000 * (row.best.carry.cash! - 1.38)) / 100, 6);
  });
});

describe("placesFor", () => {
  it("lists every live place for the amount, best cash first, without the Stability Pool", () => {
    const v = placesFor(7050, sources);
    expect(v[0].id).toBe("mezo-smusd-gauge");
    expect(v.findIndex((x) => x.pairToken)).toBeGreaterThan(v.findIndex((x) => x.id === "mezo-smusd")); // pools needing BTC or MEZO come after MUSD-only places
    expect(v.some((x) => x.chain === "Ethereum")).toBe(true);
    expect(v.some((x) => x.id === "mezo-stability-pool")).toBe(false);
  });
});
