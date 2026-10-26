import { describe, expect, it } from "vitest";
import { pct, usd } from "@/lib/format";

describe("usd", () => {
  it("never pads a trailing .0 (server and browser must print the same text)", () => {
    expect(usd(77_000)).toBe("$77K");
    expect(usd(14_200_000)).toBe("$14.2M");
    expect(usd(18)).toBe("$18");
    expect(usd(0.7106)).toBe("$0.71"); // small amounts keep cents (not "$1")
    expect(usd(null)).toBe("—");
  });
});

describe("pct sign", () => {
  it("a tiny negative that rounds to zero shows 0.00%, not −0.00%", () => {
    expect(pct(-0.004)).toBe("0.00%");
    expect(pct(-0.03)).toBe("−0.03%");
  });
});
