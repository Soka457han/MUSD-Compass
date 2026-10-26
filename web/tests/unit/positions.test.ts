import { describe, expect, it } from "vitest";
import { checkText } from "@/components/PriceLabel";
import { fixtureSources } from "@/lib/sources/fixture";
import { compare, type Positions } from "@/lib/positions";

const sources = fixtureSources();
const vaultApr = sources.venues.find((v) => v.id === "mezo-smusd")!.rates.liquidApr!;
const base: Positions = { address: "0x0000000000000000000000000000000000000001", wallet: 0, vault: 0, staked: null, stability: 0, trove: null, veMezo: null };

describe("compare", () => {
  it("idle MUSD earns 0%: the gap to the best place is the whole best cash rate", () => {
    const [row] = compare({ ...base, wallet: 1000 }, sources);
    expect(row.id).toBe("wallet");
    expect(row.nowPct).toBe(0);
    expect(row.extraPerYear).toBeCloseTo((1000 * row.best.carry.cash!) / 100, 6);
  });
  it("already in the vault when the vault is best: nothing more to gain", () => {
    const [row] = compare({ ...base, vault: 2000 }, sources);
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
  });
});
