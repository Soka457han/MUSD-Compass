import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TroveView } from "@/lib/trove";

const paid = vi.hoisted(() => vi.fn());
vi.mock("@x402/next", () => ({ withX402: () => paid })); // the payment gate itself is @x402's; here only what runs before and around it
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));
vi.mock("@/lib/sources", () => ({ loadSources: vi.fn() }));
vi.mock("@/lib/stats", () => ({ countCall: vi.fn(), countPayment: vi.fn() }));
vi.mock("@/lib/chain/clients", () => ({ mezoClient: {} }));

import { NextRequest, NextResponse } from "next/server";
import { publicTrove } from "@/lib/trove";
import { tooMany } from "@/lib/rateLimit";
import { GET as getTrove } from "@/app/api/trove/[address]/route";
import { OPTIONS as yieldsOptions } from "@/app/api/yields/route";
import { GET as getPremium, OPTIONS as premiumOptions } from "@/app/api/premium/yields/route";

const trove = (o: Partial<TroveView>) => ({ address: "0x593c000000000000000000000000000000005bb5", active: true, icrPct: 200, nicr: "1", ...o }) as TroveView;
let ip = 0; // a fresh IP per request keeps the rate limiter out of the way
const premium = (qs: string) => getPremium(new NextRequest(`https://x.test/api/premium/yields${qs}`, { headers: { "x-forwarded-for": `198.51.100.${++ip}` } }));

describe("publicTrove", () => {
  it("nulls the uint256-max ICR and NICR of an address with no trove, and leaves an open trove alone", () => {
    expect(publicTrove(trove({ active: false, icrPct: 1.1579e61, nicr: (2n ** 256n - 1n).toString() }))).toMatchObject({ icrPct: null, nicr: null, active: false });
    expect(publicTrove(trove({}))).toMatchObject({ icrPct: 200, nicr: "1" });
  });
});

describe("tooMany", () => {
  it("is a 429 with Retry-After and keeps the route's own headers", () => {
    const r = tooMany({ "Access-Control-Allow-Origin": "*" });
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("60");
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("trove what-if errors", () => {
  beforeEach(() => vi.stubEnv("COMPASS_FIXTURES", "1"));
  afterEach(() => vi.unstubAllEnvs());
  it("say what to type, not the query parameter's name", async () => {
    for (const [qs, msg] of [["?addBtc=abc", "Enter BTC"], ["?addBtc=1,5", "Enter BTC"], ["?repayMusd=-1", "Enter MUSD"], ["?repayMusd=0.123456789", "Enter MUSD"]]) {
      const r = await getTrove(new Request(`https://x.test/api/trove/sample${qs}`), { params: Promise.resolve({ address: "sample" }) });
      expect(r.status).toBe(400);
      const { error } = await r.json();
      expect(error).toMatch(new RegExp(`^${msg} as a plain number, up to 8 decimals\\.$`));
    }
  });
});

describe("CORS preflight", () => {
  it("/api/yields OPTIONS allows any origin", () => {
    const r = yieldsOptions();
    expect(r.status).toBe(204);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(r.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
  it("/api/premium/yields OPTIONS allows GET with the x402 payment header and exposes the x402 reply headers", () => {
    const r = premiumOptions();
    expect(r.status).toBe(204);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(r.headers.get("Access-Control-Allow-Headers")).toContain("PAYMENT-SIGNATURE");
    expect(r.headers.get("Access-Control-Expose-Headers")).toContain("PAYMENT-REQUIRED");
  });
});

describe("GET /api/premium/yields", () => {
  beforeEach(() => paid.mockReset());
  it("answers bad input with 400 before asking for payment", async () => {
    for (const qs of ["?amount=0", "?amount=abc", "?days=7", "?address=0x12"]) {
      const r = await premium(qs);
      expect(r.status).toBe(400);
      expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    }
    expect(paid).not.toHaveBeenCalled();
  });
  it("passes good input to the payment gate, and its 402 carries CORS", async () => {
    paid.mockResolvedValue(NextResponse.json({}, { status: 402, headers: { "PAYMENT-REQUIRED": "x" } }));
    const r = await premium("?amount=2000&address=0xfe21b2782b35be770dd4a7b05f81ce43790d676c");
    expect(r.status).toBe(402);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(r.headers.get("Access-Control-Expose-Headers")).toContain("PAYMENT-REQUIRED");
    expect(paid).toHaveBeenCalledOnce();
  });
});
