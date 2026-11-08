import { encodePaymentResponseHeader } from "@x402/core/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

const kv = vi.hoisted(() => ({ log: [] as (string | number)[][], on: true, ret: [] as unknown[] | null, fail: false }));
vi.mock("@/lib/store", () => ({
  storeConfigured: () => kv.on,
  redis: async (...cmd: (string | number)[]) => void kv.log.push(cmd),
  pipeline: async (cmds: (string | number)[][]) => {
    kv.log.push(...cmds);
    return kv.fail ? null : (kv.ret ?? cmds.map(() => null));
  },
}));

import { countCall, countEmbedHost, countPayment, readStatsNow } from "@/lib/stats";

const OWN = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C";
const OUTSIDER = "0x1234567890AbcdEF1234567890aBcdef12345678";
const settle = (payer: string | undefined, network = "eip155:31611", success = true) =>
  encodePaymentResponseHeader({ success, payer, transaction: "0xabc", network } as never);
const cmdNames = () => kv.log.map((c) => c.join(" "));

beforeEach(() => {
  kv.log = [];
  kv.on = true;
  kv.ret = null;
  kv.fail = false;
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("countCall", () => {
  it("counts nothing for warm=1", async () => {
    await countCall("yields", new Request("https://x.test/api/yields?warm=1"));
    expect(kv.log).toEqual([]);
  });

  it("counts total, daily with 40-day expiry, and since", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-08T10:00:00Z") });
    await countCall("trove", new Request("https://x.test/api/trove/sample"));
    expect(kv.log).toEqual([
      ["INCR", "stats:calls:trove"],
      ["INCR", "stats:calls:trove:2026-11-08"],
      ["EXPIRE", "stats:calls:trove:2026-11-08", 3456000],
      ["SET", "stats:since", "2026-11-08", "NX"],
    ]);
  });

  it("adds exactly one PFADD for the bot header, and ignores a malformed one", async () => {
    vi.stubEnv("BOT_API_KEY", "k");
    const bot = { "x-compass-bot": "k" };
    await countCall("yields", new Request("https://x.test/api/yields", { headers: { ...bot, "x-compass-user": "0123456789abcdef" } }));
    expect(kv.log.filter((c) => c[0] === "PFADD")).toEqual([["PFADD", "stats:botusers", "0123456789abcdef"]]);
    kv.log = [];
    await countCall("yields", new Request("https://x.test/api/yields", { headers: { ...bot, "x-compass-user": "123456789" } }));
    expect(kv.log.some((c) => c[0] === "PFADD")).toBe(false);
  });

  it("ignores the user header without the real bot key", async () => {
    vi.stubEnv("BOT_API_KEY", "k");
    for (const bot of [{}, { "x-compass-bot": "wrong" }] as Record<string, string>[]) {
      await countCall("yields", new Request("https://x.test/api/yields", { headers: { ...bot, "x-compass-user": "0123456789abcdef" } }));
    }
    expect(kv.log.some((c) => c[0] === "PFADD")).toBe(false);
    expect(kv.log.filter((c) => c[0] === "INCR")).toHaveLength(4); // still counted as ordinary calls
  });
});

describe("countEmbedHost", () => {
  it.each([
    "https://musd-compass.vercel.app/x",
    "https://musd-compass-git-wave2b-me.vercel.app/",
    "http://localhost:3000/",
    "http://127.0.0.1:3000/",
    null,
    "not a url",
  ])("skips %s", async (ref) => {
    await countEmbedHost(ref, "iframe");
    expect(kv.log).toEqual([]);
  });

  it("counts only iframe loads, and skips IP literals and single-label hosts", async () => {
    for (const [ref, dest] of [["https://blog.example.org/", "document"], ["https://blog.example.org/", null], ["http://192.168.1.5/", "iframe"], ["http://[::1]/", "iframe"], ["http://intranet/", "iframe"]] as const) {
      await countEmbedHost(ref, dest);
    }
    expect(kv.log).toEqual([]);
  });

  it("counts an outside host, not its path", async () => {
    await countEmbedHost("https://blog.example.org/post/1?x=1", "iframe");
    expect(kv.log).toEqual([["ZINCRBY", "stats:embed:hosts", 1, "blog.example.org"]]);
  });

  it("does not treat a lookalike as ours", async () => {
    await countEmbedHost("https://musd-compass.vercel.app.evil.com/", "iframe");
    expect(kv.log).toHaveLength(1);
  });
});

describe("countPayment", () => {
  it("routes our own wallet to own, case-insensitively", async () => {
    await countPayment(settle(OWN.toLowerCase()));
    expect(cmdNames()).toEqual(["INCR stats:x402:own:testnet"]);
  });

  it("counts an outside payer as a payment and a lowercase HLL member", async () => {
    await countPayment(settle(OUTSIDER, "eip155:31612"));
    expect(kv.log).toEqual([
      ["INCR", "stats:x402:payments:mainnet"],
      ["PFADD", "stats:x402:payers:mainnet", OUTSIDER.toLowerCase()],
    ]);
  });

  it("counts nothing for a failed settlement, an unknown network, a malformed or missing header", async () => {
    await countPayment(settle(OUTSIDER, "eip155:31611", false));
    await countPayment(settle(OUTSIDER, "eip155:1"));
    await countPayment("%%%not-base64-json");
    await countPayment(null);
    expect(kv.log).toEqual([]);
  });
});

describe("readStatsNow", () => {
  it("is null when the store is not configured or fails", async () => {
    kv.on = false;
    expect(await readStatsNow()).toBeNull();
    kv.on = true;
    kv.fail = true;
    expect(await readStatsNow()).toBeNull(); // pipeline null
  });

  it("assembles totals, last7, hosts and x402 from one pipeline", async () => {
    // order: since, botusers, hosts, then per route [total, 7 days], then per net [payments, payers, own]
    const route = (t: number, d: number) => [String(t), String(d), null, null, null, null, null, "1"];
    kv.ret = ["2026-11-01", 5, ["a.org", "3", "b.org", "1"], ...route(10, 2), ...route(20, 4), ...route(30, 6), ...route(40, 8), "7", 3, "2", 0, 0, null];
    const s = await readStatsNow();
    expect(s).toEqual({
      since: "2026-11-01",
      calls: { yields: { total: 10, last7: 3 }, premium: { total: 20, last7: 5 }, trove: { total: 30, last7: 7 }, embed: { total: 40, last7: 9 } },
      botUsers: 5,
      x402: { testnet: { payments: 7, payers: 3, own: 2 }, mainnet: { payments: 0, payers: 0, own: 0 } },
      embedHosts: [{ host: "a.org", count: 3 }, { host: "b.org", count: 1 }],
    });
    expect(kv.log.find((c) => c[0] === "ZREVRANGE")).toEqual(["ZREVRANGE", "stats:embed:hosts", 0, 19, "WITHSCORES"]);
  });
});
