import { describe, expect, it } from "vitest";
import { cleanAmount, parseQuery, parseQueryLenient } from "@/lib/yields";

describe("parseQueryLenient", () => {
  it("keeps every valid field and drops only the bad ones", () => {
    expect(parseQueryLenient(new URLSearchParams("amount=2000&mode=borrower&rate=9&trove=bogus"))).toEqual({ amount: 2000, mode: "borrower", trove: "new", days: 90, ratePct: null });
    expect(parseQueryLenient(new URLSearchParams("amount=0&mode=borrower&days=365&rate=0.5&trove=existing"))).toEqual({ amount: 2000, mode: "borrower", trove: "existing", days: 365, ratePct: null });
    expect(parseQueryLenient(new URLSearchParams("amount=1e3&mode=whale&days=60&rate=3"))).toEqual({ amount: 1000, mode: "holder", trove: "new", days: 90, ratePct: 3 });
  });
  it("matches parseQuery when everything is valid", () => {
    const sp = new URLSearchParams("amount=5000&mode=borrower&days=30&rate=2&trove=new");
    expect(parseQueryLenient(sp)).toEqual((parseQuery(sp) as { ok: true; query: unknown }).query);
  });
});

describe("cleanAmount", () => {
  const amount = (typed: string) => parseQuery(new URLSearchParams({ amount: cleanAmount(typed) }));
  it("drops thousands separators only", () => {
    expect(cleanAmount("1,000 000_0")).toBe("10000000");
  });
  it("reads typed input the way ?amount= reads it", () => {
    expect(amount("1e3")).toMatchObject({ ok: true, query: { amount: 1000 } });
    expect(amount("2,500.5")).toMatchObject({ ok: true, query: { amount: 2500.5 } });
  });
  it("leaves bad input visible so parseQuery rejects it", () => {
    for (const bad of ["abc", "-5", "1.2.3", "0", "10000001"]) expect(amount(bad).ok).toBe(false);
  });
});
