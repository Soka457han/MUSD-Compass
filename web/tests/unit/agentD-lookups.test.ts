import { describe, expect, it } from "vitest";
import { nowText } from "@/components/MyPanel";
import { ratio } from "@/components/TrovePanel";
import { fixtureSources } from "@/lib/sources/fixture";
import { compare, movable, type Positions } from "@/lib/positions";

const sources = fixtureSources();
const noGauge = { ...sources, venues: sources.venues.filter((v) => v.id !== "mezo-smusd-gauge") };
const base: Positions = { address: "0x0000000000000000000000000000000000000001", wallet: 0, vault: 0, staked: null, stakedApr: null, stability: 0, trove: null, veMezo: null };

describe("nowText for staked sMUSD", () => {
  const gaugeApr = sources.venues.find((v) => v.id === "mezo-smusd-gauge")!.rates.emissionsApr!;
  it("states today's rate and the lower rate once the other movable MUSD joins the gauge", () => {
    const p = { ...base, wallet: 57_467, staked: 5000, stakedApr: gaugeApr };
    const row = compare(p, sources).find((r) => r.id === "staked")!;
    expect(row.best.id).toBe("mezo-smusd-gauge");
    const text = nowText(row, 4, movable(p));
    expect(text).toContain(`Earns about ${gaugeApr.toFixed(2)}% a year now (about ${row.best.carry.cash!.toFixed(2)}% once your other 57,467 MUSD joins), paid in MEZO.`);
  });
  it("says one rate when nothing else would join, or when the gauge is not the best place", () => {
    const alone = compare({ ...base, staked: 5000, stakedApr: gaugeApr }, sources)[0];
    expect(nowText(alone, 4, 0)).toMatch(/^Earns about [\d.]+% a year, paid in MEZO\./);
    const vaultBest = compare({ ...base, wallet: 1000, staked: 5000, stakedApr: 1.38 }, noGauge).find((r) => r.id === "staked")!;
    expect(nowText(vaultBest, 4, 1000)).not.toContain("once your other");
  });
});

describe("ratio", () => {
  it("prints normal ratios, caps absurd ones and tolerates no trove", () => {
    expect(ratio(333.4)).toBe("333%");
    expect(ratio(10_000)).toBe("10,000%");
    expect(ratio(223_973)).toBe("over 10,000%");
    expect(ratio(4.6e22)).toBe("over 10,000%");
    expect(ratio(null)).toBe("—");
    expect(ratio(undefined)).toBe("—");
  });
});
