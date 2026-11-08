import { timingSafeEqual } from "node:crypto";

// shortcut: per-instance memory, so the limit is per serverless instance, not global; upgrade to a shared store if abused.
const WINDOW_MS = 60_000;
const LIMIT = 60;
const hits = new Map<string, { count: number; reset: number }>();

/** True when the request carries the bot's shared secret (timing-safe compare). */
export function isBot(req: Request): boolean {
  const key = process.env.BOT_API_KEY;
  const given = req.headers.get("x-compass-bot");
  if (!key || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True when this caller may proceed. The bot (shared secret) is exempt: all its traffic comes from one IP. */
export function allow(req: Request): boolean {
  if (isBot(req)) return true;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    if (hits.size > 10_000) hits.clear();
    return true;
  }
  return ++h.count <= LIMIT;
}
