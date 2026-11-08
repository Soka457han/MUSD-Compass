import { afterEach, describe, expect, it, vi } from "vitest";
import { pipeline, redis, storeConfigured } from "@/lib/store";

const clearEnv = () => {
  for (const k of ["UPSTASH_REDIS_REST_URL", "KV_REST_API_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"])
    vi.stubEnv(k, "");
};
const configure = () => {
  clearEnv();
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://r.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("store (Upstash REST)", () => {
  it("unconfigured: returns null and never calls fetch", async () => {
    clearEnv();
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(storeConfigured()).toBe(false);
    expect(await redis("INCR", "k")).toBeNull();
    expect(await pipeline([["INCR", "k"]])).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("accepts the KV_REST_API_* names", () => {
    clearEnv();
    vi.stubEnv("KV_REST_API_URL", "https://r.test");
    vi.stubEnv("KV_REST_API_TOKEN", "tok");
    expect(storeConfigured()).toBe(true);
  });

  it("sends the command with a bearer header and returns result", async () => {
    configure();
    const f = vi.fn().mockResolvedValue(json({ result: 7 }));
    vi.stubGlobal("fetch", f);
    expect(await redis("INCR", "k")).toBe(7);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://r.test");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.body).toBe('["INCR","k"]');
  });

  it("returns null on fetch rejection, non-2xx and an error body", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await redis("GET", "k")).toBeNull();
    expect(await pipeline([["GET", "k"]])).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 500)));
    expect(await redis("GET", "k")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "ERR" })));
    expect(await redis("GET", "k")).toBeNull();
  });

  it("pipeline posts to /pipeline and maps results in order, errors to null", async () => {
    configure();
    const f = vi.fn().mockResolvedValue(json([{ result: 1 }, { error: "bad" }, { result: "v" }]));
    vi.stubGlobal("fetch", f);
    expect(await pipeline([["INCR", "a"], ["FOO"], ["GET", "b"]])).toEqual([1, null, "v"]);
    expect(f.mock.calls[0][0]).toBe("https://r.test/pipeline");
  });
});
