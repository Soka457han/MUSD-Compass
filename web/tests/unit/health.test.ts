import { describe, expect, it } from "vitest";
import { check } from "@/lib/health";

describe("health check", () => {
  it("reports a failure without leaking the upstream error text (it can contain a keyed RPC URL)", async () => {
    const r = await check("mezo-mainnet", () => Promise.reject(new Error("HTTP request failed. URL: https://rpc.example/v1/SECRET-KEY-123")));
    expect(r).toMatchObject({ name: "mezo-mainnet", ok: false, error: "unreachable" });
    expect(JSON.stringify(r)).not.toContain("SECRET-KEY-123");
  });

  it("reports the value and time on success", async () => {
    const r = await check("merkl", () => Promise.resolve("MEZO $0.0047"));
    expect(r).toMatchObject({ name: "merkl", ok: true, value: "MEZO $0.0047" });
    expect(typeof r.ms).toBe("number");
  });
});
