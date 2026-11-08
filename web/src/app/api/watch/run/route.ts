import { timingSafeEqual } from "node:crypto";
import type { Address, PublicClient } from "viem";
import { alertKey, alertText, sendTelegramStatus } from "@/lib/alerts";
import { mezoClient } from "@/lib/chain/clients";
import { troveAdvice } from "@/lib/safety";
import { loadSources } from "@/lib/sources";
import { fetchTroveQueue } from "@/lib/sources/troveQueue";
import { readTrove } from "@/lib/trove";
import { allWatches, getState, removeWatch, setState } from "@/lib/watch";

export const maxDuration = 300;
const BATCH = 8;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Called every 15 minutes by .github/workflows/watch.yml: messages a chat when its trove's advice changes. */
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const origin = new URL(req.url).origin;
  const watches = await allWatches();
  const out = { checked: 0, sent: 0, failed: 0 };
  if (!watches.length) return Response.json(out);

  const client = mezoClient as PublicClient;
  let feePct: number;
  let queue: bigint[] | null;
  try {
    const [sources, q] = await Promise.all([loadSources(), fetchTroveQueue().catch(() => null)]);
    feePct = sources.borrow.feePct;
    queue = q ? q.map(BigInt) : null;
  } catch {
    return Response.json({ ...out, failed: watches.length });
  }

  const one = async ({ chatId, address }: { chatId: number; address: string }) => {
    try {
      const view = await readTrove(client, address as Address, feePct, queue);
      const advice = troveAdvice(view);
      const key = alertKey(advice, view.active);
      const saved = await getState(chatId, address);
      out.checked++;
      if (key === saved) return;
      // Compass sizes troves to 200%, so a ratio hovering there must not flip the alert: stay quiet until clearly above.
      if (key === "ok" && saved && saved.split("|").every((s) => s.startsWith("watch:")) && view.icrPct < 210) return;
      if (saved === null && key === "ok") return void (await setState(chatId, address, key));
      const status = await sendTelegramStatus(chatId, alertText(address, view, advice, origin));
      if (status >= 200 && status < 300) {
        await setState(chatId, address, key);
        out.sent++;
      } else {
        out.failed++;
        if (status === 403) await removeWatch(chatId, address); // the user blocked the bot
      }
    } catch {
      out.failed++;
    }
  };
  for (let i = 0; i < watches.length; i += BATCH) await Promise.all(watches.slice(i, i + BATCH).map(one));
  return Response.json(out);
}
