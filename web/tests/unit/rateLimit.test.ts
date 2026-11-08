import { afterEach, describe, expect, it, vi } from "vitest";
import { allow, isBot } from "@/lib/rateLimit";

const req = (headers: Record<string, string>) => new Request("https://x.test/api/yields", { headers });

afterEach(() => vi.unstubAllEnvs());

describe("allow (per-IP limit, bot key exempt)", () => {
  it("lets the bot through with the right key and never with a wrong one of the same length", () => {
    vi.stubEnv("BOT_API_KEY", "k".repeat(32));
    const ip = { "x-forwarded-for": "203.0.113.9" };
    for (let i = 0; i < 100; i++) expect(allow(req({ ...ip, "x-compass-bot": "k".repeat(32) }))).toBe(true);
    let blocked = false;
    for (let i = 0; i < 100; i++) if (!allow(req({ ...ip, "x-compass-bot": "x".repeat(32) }))) blocked = true;
    expect(blocked).toBe(true);
  });

  it("a multi-byte header of the same character length is rejected without throwing", () => {
    vi.stubEnv("BOT_API_KEY", "k".repeat(8));
    expect(isBot(req({ "x-compass-bot": "é".repeat(8) }))).toBe(false);
  });

  it("an empty configured key exempts nobody", () => {
    vi.stubEnv("BOT_API_KEY", "");
    const ip = { "x-forwarded-for": "203.0.113.10", "x-compass-bot": "" };
    let blocked = false;
    for (let i = 0; i < 100; i++) if (!allow(req(ip))) blocked = true;
    expect(blocked).toBe(true);
  });
});
