import { describe, expect, it, vi } from "vitest";
vi.mock("@vercel/functions", async (orig) => ({ ...(await orig<typeof import("@vercel/functions")>()), waitUntil: (p: Promise<unknown>) => void p }));
import { SHARED_FRESH_MS, sharedRead } from "@/lib/sources";
import { fixtureSources } from "@/lib/sources/fixture";

// A runtime cache that stores JSON, as Vercel's does, so a value that does not survive the round trip shows up here.
const jsonCache = () => {
  const m = new Map<string, string>();
  return {
    get: vi.fn(async (k: string) => (m.has(k) ? JSON.parse(m.get(k)!) : null)),
    set: vi.fn(async (k: string, v: unknown) => void m.set(k, JSON.stringify(v))),
    delete: vi.fn(async (k: string) => void m.delete(k)),
    expireTag: vi.fn(async () => {}),
  };
};

describe("sharedRead (runtime cache under our own key)", () => {
  it("empty: reads now and stores; fresh: serves the stored value without reading", async () => {
    const cache = jsonCache();
    const read = vi.fn(async () => ({ n: 1 }));
    expect(await sharedRead("k", read, cache as never, Date.now())).toEqual({ n: 1 });
    expect(await sharedRead("k", read, cache as never, Date.now())).toEqual({ n: 1 });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("stale: serves the old value at once and refreshes in the background", async () => {
    const cache = jsonCache();
    await cache.set("k", { at: 0, value: { n: "old" } });
    const read = vi.fn(async () => ({ n: "new" }));
    expect(await sharedRead("k", read, cache as never, SHARED_FRESH_MS + 1)).toEqual({ n: "old" });
    await vi.waitFor(() => expect(cache.set).toHaveBeenCalledTimes(2));
    expect(await sharedRead("k", read, cache as never, Date.now())).toEqual({ n: "new" });
  });

  it("a cache that fails to answer counts as empty instead of breaking the page", async () => {
    const cache = { ...jsonCache(), get: vi.fn(async () => { throw new Error("down"); }) };
    expect(await sharedRead("k", async () => 7, cache as never, 0)).toBe(7);
  });

  it("the real Sources value survives the JSON round trip the runtime cache makes, well under its 2 MB item limit", async () => {
    const s = await fixtureSources();
    const json = JSON.stringify(s);
    expect(JSON.parse(json)).toEqual(s);
    expect(json.length).toBeLessThan(2_000_000);
  });
});
