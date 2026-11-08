import { beforeEach, describe, expect, it, vi } from "vitest";

const kv = vi.hoisted(() => ({ sets: new Map<string, Set<string>>(), strs: new Map<string, string>(), on: true }));
vi.mock("@/lib/store", () => {
  const run = (cmd: (string | number)[]) => {
    const [op, key, val] = cmd as string[];
    const s = kv.sets.get(key) ?? new Set<string>();
    switch (op) {
      case "SADD": kv.sets.set(key, s.add(val)); return 1;
      case "SREM": return s.delete(val) ? 1 : 0;
      case "SISMEMBER": return s.has(val) ? 1 : 0;
      case "SCARD": return s.size;
      case "SMEMBERS": return [...s];
      case "GET": return kv.strs.get(key) ?? null;
      case "SET": kv.strs.set(key, val); return "OK";
      case "DEL": return kv.strs.delete(key) ? 1 : 0;
    }
    return null;
  };
  return {
    storeConfigured: () => kv.on,
    redis: async (...cmd: (string | number)[]) => run(cmd),
    pipeline: async (cmds: (string | number)[][]) => cmds.map(run),
  };
});

import { addWatch, allWatches, getState, listWatches, removeWatch, setState } from "@/lib/watch";

const A = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C";
const addr = (i: number) => `0x${String(i).padStart(40, "0")}`;
beforeEach(() => {
  kv.sets.clear();
  kv.strs.clear();
  kv.on = true;
});

describe("watch store", () => {
  it("adds, then reports exists (case-insensitive)", async () => {
    expect(await addWatch(1, A)).toBe("added");
    expect(await addWatch(1, A.toLowerCase())).toBe("exists");
    expect(await listWatches(1)).toEqual([A.toLowerCase()]);
    expect(await allWatches()).toEqual([{ chatId: 1, address: A.toLowerCase() }]);
  });

  it("limits a chat to 3 addresses but still says exists for one it has", async () => {
    for (let i = 1; i <= 3; i++) expect(await addWatch(1, addr(i))).toBe("added");
    expect(await addWatch(1, addr(4))).toBe("limit");
    expect(await addWatch(1, addr(1))).toBe("exists");
  });

  it("says full at 500 watches in total", async () => {
    kv.sets.set("watch:all", new Set(Array.from({ length: 500 }, (_, i) => `${i + 100}|x${i}`)));
    expect(await addWatch(1, A)).toBe("full");
  });

  it("remove drops both sets and the state key", async () => {
    await addWatch(1, A);
    await setState(1, A, "act:low");
    expect(await getState(1, A.toLowerCase())).toBe("act:low");
    expect(await removeWatch(1, A)).toBe(true);
    expect(await listWatches(1)).toEqual([]);
    expect(await allWatches()).toEqual([]);
    expect(await getState(1, A)).toBeNull();
    expect(await removeWatch(1, A)).toBe(false);
  });

  it("returns off when the store is not configured", async () => {
    kv.on = false;
    expect(await addWatch(1, A)).toBe("off");
  });
});
