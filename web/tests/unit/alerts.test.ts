import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Advice } from "@/lib/safety";
import type { TroveView } from "@/lib/trove";

vi.mock("@/lib/watch", () => ({ allWatches: vi.fn(), getState: vi.fn(), setState: vi.fn(), removeWatch: vi.fn() }));
vi.mock("@/lib/trove", async (orig) => ({ ...(await orig<typeof import("@/lib/trove")>()), readTrove: vi.fn() }));
vi.mock("@/lib/sources", () => ({ loadSources: vi.fn() }));
vi.mock("@/lib/sources/troveQueue", () => ({ fetchTroveQueue: vi.fn() }));
vi.mock("@/lib/chain/clients", () => ({ mezoClient: {} }));
vi.mock("next/server", () => ({ after: () => {} })); // the trove route schedules a stats call outside a request scope

import { alertKey, alertText, sendTelegram } from "@/lib/alerts";
import { REDEMPTION_PRESSURE_TITLE } from "@/lib/safety";
import { GET as getTrove } from "@/app/api/trove/[address]/route";
import { GET } from "@/app/api/watch/run/route";
import { readTrove } from "@/lib/trove";
import { loadSources } from "@/lib/sources";
import { fetchTroveQueue } from "@/lib/sources/troveQueue";
import { allWatches, getState, removeWatch, setState } from "@/lib/watch";

const ADDR = "0x593c000000000000000000000000000000005bb5";
const watchAdv: Advice = { level: "watch", title: "Your ratio is under 200%", detail: "Add <BTC> & repay." };
const okAdv: Advice = { level: "ok", title: "Your ratio is comfortable", detail: "fine" };
const view = (o: Partial<TroveView> = {}) => ({ address: ADDR, active: true, icrPct: 180, ahead: 5, recoveryMode: false, debt: 5000, collateralUsd: 9000, btcUsd: 80000, nicr: "1", ...o }) as TroveView;

describe("alertKey", () => {
  it("is stable, sorted, and quiet for ok and closed", () => {
    const b: Advice = { level: "act", title: "B", detail: "" };
    expect(alertKey([watchAdv, b], true)).toBe(alertKey([b, watchAdv], true));
    expect(alertKey([okAdv], true)).toBe("ok");
    expect(alertKey([okAdv], true)).not.toBe(alertKey([watchAdv], true));
    expect(alertKey([], false)).toBe("closed");
  });
});

describe("alertText", () => {
  it("has the title, both links and escapes data", () => {
    const t = alertText(ADDR, view(), [watchAdv], "https://x.test");
    expect(t).toContain("Your ratio is under 200%");
    expect(t).not.toContain("/vault");
    expect(t).toContain("Add BTC or repay MUSD in the Mezo app: https://mezo.org");
    expect(t).toContain("https://x.test/trove");
    expect(t).toContain("Add &lt;BTC&gt; &amp; repay.");
    expect(t).not.toContain("<BTC>");
  });
  it("offers the Compass top-up and repay page only where mainnet is switched on, and always names the Mezo app", () => {
    vi.stubEnv("NEXT_PUBLIC_MAINNET_WRITES", "1");
    const t = alertText(ADDR, view(), [watchAdv], "https://x.test");
    vi.unstubAllEnvs();
    expect(t).toContain('Add BTC or repay MUSD <a href="https://x.test/vault?net=mainnet">in Compass</a> or in the Mezo app: https://mezo.org');
  });
  it("says all clear and no open trove", () => {
    expect(alertText(ADDR, view({ icrPct: 250 }), [okAdv], "https://x.test")).toContain("All clear");
    expect(alertText(ADDR, view({ active: false }), [], "https://x.test")).toContain("no open trove");
  });
});

describe("sendTelegram", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("returns false without a token and does not fetch", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f); vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    expect(await sendTelegram(1, "x")).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it("is true on 2xx, false otherwise", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "T");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    expect(await sendTelegram(1, "x")).toBe(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    expect(await sendTelegram(1, "x")).toBe(false);
  });
});

describe("GET /api/watch/run", () => {
  const req = (auth?: string) => new Request("https://x.test/api/watch/run", { headers: auth ? { authorization: auth } : {} });
  let tg: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "T");
    tg = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", tg);
    vi.mocked(allWatches).mockResolvedValue([{ chatId: 7, address: ADDR }]);
    vi.mocked(loadSources).mockResolvedValue({ borrow: { feePct: 0.1 } } as never);
    vi.mocked(fetchTroveQueue).mockResolvedValue([]);
    vi.mocked(readTrove).mockResolvedValue(view());
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("401 without or with a wrong token, and when CRON_SECRET is unset, with no reads", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer nope"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(401);
    expect(allWatches).not.toHaveBeenCalled();
    expect(readTrove).not.toHaveBeenCalled();
  });

  it("first run with ok advice saves the key and sends nothing", async () => {
    vi.mocked(readTrove).mockResolvedValue(view({ icrPct: 300 }));
    vi.mocked(getState).mockResolvedValue(null);
    const r = await (await GET(req("Bearer s3cret"))).json();
    expect(setState).toHaveBeenCalledWith(7, ADDR, "ok");
    expect(tg).not.toHaveBeenCalled();
    expect(r).toEqual({ checked: 1, sent: 0, failed: 0 });
  });

  it("a changed key sends once, then saves it", async () => {
    vi.mocked(getState).mockResolvedValue("ok");
    const r = await (await GET(req("Bearer s3cret"))).json();
    expect(tg).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith(7, ADDR, expect.stringContaining("watch:"));
    expect(r.sent).toBe(1);
  });

  it("the same key sends nothing", async () => {
    const { troveAdvice } = await import("@/lib/safety");
    const v = view();
    vi.mocked(getState).mockResolvedValue(alertKey(troveAdvice(v), true));
    await GET(req("Bearer s3cret"));
    expect(tg).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });

  it("hysteresis: a watch-only alert stays put until the ratio is 210% or more", async () => {
    vi.mocked(getState).mockResolvedValue("watch:Your ratio is under 200%");
    vi.mocked(readTrove).mockResolvedValue(view({ icrPct: 205 }));
    await GET(req("Bearer s3cret"));
    expect(tg).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
    vi.mocked(readTrove).mockResolvedValue(view({ icrPct: 215 }));
    await GET(req("Bearer s3cret"));
    expect(tg).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith(7, ADDR, "ok");
  });

  it("a closed trove sends one message, then silence", async () => {
    vi.mocked(readTrove).mockResolvedValue(view({ active: false }));
    vi.mocked(getState).mockResolvedValueOnce("ok").mockResolvedValueOnce("closed");
    await GET(req("Bearer s3cret"));
    await GET(req("Bearer s3cret"));
    expect(tg).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith(7, ADDR, "closed");
  });

  it("a failed send does not save the state", async () => {
    vi.mocked(getState).mockResolvedValue("ok");
    tg.mockResolvedValue(new Response("{}", { status: 500 }));
    const r = await (await GET(req("Bearer s3cret"))).json();
    expect(setState).not.toHaveBeenCalled();
    expect(removeWatch).not.toHaveBeenCalled();
    expect(r.failed).toBe(1);
  });

  it("403 removes the watch", async () => {
    vi.mocked(getState).mockResolvedValue("ok");
    tg.mockResolvedValue(new Response("{}", { status: 403 }));
    await GET(req("Bearer s3cret"));
    expect(removeWatch).toHaveBeenCalledWith(7, ADDR);
    expect(setState).not.toHaveBeenCalled();
  });

  it("a read that throws counts as failed and leaves state alone", async () => {
    vi.mocked(readTrove).mockRejectedValue(new Error("rpc"));
    const r = await (await GET(req("Bearer s3cret"))).json();
    expect(r).toEqual({ checked: 0, sent: 0, failed: 1 });
    expect(setState).not.toHaveBeenCalled();
    expect(tg).not.toHaveBeenCalled();
  });
});

describe("redemption pressure alert hysteresis", () => {
  const req = new Request("https://x.test/api/watch/run", { headers: { authorization: "Bearer s3cret" } });
  const peg = (priceUsd: number) => ({ borrow: { feePct: 0.1 }, peg: { priceUsd, floorUsd: 0.9925, redemptionPct: 0.75 } }) as never;
  const FIRST = "watch:Your trove is first in line for redemptions";
  const first = view({ icrPct: 300, collateralUsd: 60_000, ahead: 0, troves: 4 });
  let tg: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "T");
    tg = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", tg);
    vi.mocked(allWatches).mockResolvedValue([{ chatId: 7, address: ADDR }]);
    vi.mocked(fetchTroveQueue).mockResolvedValue([]);
    vi.mocked(readTrove).mockResolvedValue(first);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("a new alert needs the 0.002 margin: just under the floor stays quiet", async () => {
    vi.mocked(getState).mockResolvedValue(FIRST); // first in line of 4 always has this alert
    vi.mocked(loadSources).mockResolvedValue(peg(0.9924));
    await GET(req);
    expect(tg).not.toHaveBeenCalled();
    vi.mocked(loadSources).mockResolvedValue(peg(0.9904));
    await GET(req);
    expect(tg).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith(7, ADDR, expect.stringContaining(REDEMPTION_PRESSURE_TITLE));
  });
  it("an existing alert stays while under the floor and clears at the floor", async () => {
    vi.mocked(getState).mockResolvedValue(`watch:${REDEMPTION_PRESSURE_TITLE}`); // the pressure warning stands in for "first in line"
    vi.mocked(loadSources).mockResolvedValue(peg(0.9924));
    await GET(req);
    expect(tg).not.toHaveBeenCalled(); // same key
    vi.mocked(loadSources).mockResolvedValue(peg(0.9925));
    await GET(req);
    expect(tg).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith(7, ADDR, FIRST);
  });
  it("a trove near 200% still hears that the pressure cleared, so the next dip can alert again", async () => {
    // 6th of 100, at 205%: only the pressure alert is standing. The quiet rule for ratios hovering at 200% must not swallow its all clear.
    vi.mocked(readTrove).mockResolvedValue(view({ icrPct: 205, collateralUsd: 10_250, ahead: 5, troves: 100 }));
    vi.mocked(getState).mockResolvedValue(`watch:${REDEMPTION_PRESSURE_TITLE}`);
    vi.mocked(loadSources).mockResolvedValue(peg(0.9951));
    await GET(req);
    expect(tg).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith(7, ADDR, "ok");
  });
  it("a failed price or queue read leaves a standing pressure alert alone: no false all clear", async () => {
    vi.mocked(getState).mockResolvedValue(`watch:${REDEMPTION_PRESSURE_TITLE}`);
    vi.mocked(loadSources).mockResolvedValue({ borrow: { feePct: 0.1 }, peg: null } as never);
    expect(await (await GET(req)).json()).toEqual({ checked: 1, sent: 0, failed: 0 });
    vi.mocked(loadSources).mockResolvedValue(peg(0.9951));
    vi.mocked(fetchTroveQueue).mockRejectedValue(new Error("rpc"));
    await GET(req);
    expect(tg).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
  });
});

describe("GET /api/trove/[address]", () => {
  const sample = (qs = "") => getTrove(new Request(`https://x.test/api/trove/sample${qs}`), { params: Promise.resolve({ address: "sample" }) });
  beforeEach(() => vi.stubEnv("COMPASS_FIXTURES", "1"));
  afterEach(() => vi.unstubAllEnvs());

  it("returns market and nicr, and no preview without a query", async () => {
    const b = await (await sample()).json();
    expect(b.market).toEqual({ musdUsd: 0.9951, floorUsd: 0.9925, redemptionPct: 0.75 });
    expect(typeof b.nicr).toBe("string");
    expect(b.preview).toBeUndefined();
  });
  it("returns a preview for addBtc and repayMusd", async () => {
    const b = await (await sample("?addBtc=0.5&repayMusd=100.5")).json();
    expect(b.preview).toMatchObject({ collateralBtc: 1.75, debt: 30_109.9, ahead: null, troves: 0 });
  });
  it("400s on a malformed query or a change previewTrove rejects", async () => {
    for (const qs of ["?addBtc=abc", "?repayMusd=-1", "?addBtc=1.123456789", "?addBtc=1e3"]) {
      const r = await sample(qs);
      expect(r.status).toBe(400);
      expect((await r.json()).error).toEqual(expect.any(String));
    }
    expect((await sample("?repayMusd=99999")).status).toBe(400);
  });
});
