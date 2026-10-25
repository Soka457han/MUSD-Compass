import { afterEach, describe, expect, it, vi } from "vitest";
import { allow } from "@/lib/rateLimit";

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

  it("an empty configured key exempts nobody", () => {
    vi.stubEnv("BOT_API_KEY", "");
    const ip = { "x-forwarded-for": "203.0.113.10", "x-compass-bot": "" };
    let blocked = false;
    for (let i = 0; i < 100; i++) if (!allow(req(ip))) blocked = true;
    expect(blocked).toBe(true);
  });
});
