import { beforeEach, describe, expect, it, vi } from "vitest";

const w = vi.hoisted(() => ({ addWatch: vi.fn(), removeWatch: vi.fn(), listWatches: vi.fn() }));
vi.mock("@/lib/watch", () => w);

import { POST } from "@/app/api/watch/route";

const A = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C";
const call = (body: unknown, key: string | null = "k", raw?: string) =>
  POST(new Request("http://x/api/watch", { method: "POST", headers: key ? { "x-compass-bot": key } : {}, body: raw ?? JSON.stringify(body) }));

beforeEach(() => {
  vi.stubEnv("BOT_API_KEY", "k");
  Object.values(w).forEach((f) => f.mockReset());
});

describe("POST /api/watch", () => {
  it("401 without the bot key and touches nothing", async () => {
    expect((await call({ chatId: 1, action: "list" }, null)).status).toBe(401);
    expect((await call({ chatId: 1, action: "list" }, "bad")).status).toBe(401);
    expect(w.listWatches).not.toHaveBeenCalled();
  });

  it("400 on bad JSON, chatId, action or address", async () => {
    expect((await call(null, "k", "{nope")).status).toBe(400);
    expect((await call({ chatId: 1.5, action: "list" })).status).toBe(400);
    expect((await call({ chatId: 1e300, action: "list" })).status).toBe(400);
    expect((await call({ chatId: "1", action: "list" })).status).toBe(400);
    expect((await call({ chatId: 1, action: "drop", address: A })).status).toBe(400);
    expect((await call({ chatId: 1, action: "add", address: "0x123" })).status).toBe(400);
    expect((await call({ chatId: 1, action: "remove" })).status).toBe(400);
    expect(w.addWatch).not.toHaveBeenCalled();
  });

  it("add, remove and list answer with the documented shapes", async () => {
    w.addWatch.mockResolvedValue("added");
    w.removeWatch.mockResolvedValue(true);
    w.listWatches.mockResolvedValue([A.toLowerCase()]);
    const add = await call({ chatId: 7, action: "add", address: A });
    expect(await add.json()).toEqual({ status: "added" });
    expect(add.headers.get("cache-control")).toBe("no-store");
    expect(w.addWatch).toHaveBeenCalledWith(7, A);
    expect(await (await call({ chatId: 7, action: "remove", address: A })).json()).toEqual({ removed: true });
    expect(await (await call({ chatId: 7, action: "list" })).json()).toEqual({ addresses: [A.toLowerCase()] });
  });
});
