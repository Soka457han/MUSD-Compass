import type { Advice } from "@/lib/safety";
import type { TroveView } from "@/lib/trove";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** Same advice gives the same key, so a repeat is not sent twice. "ok" and "closed" are the two quiet keys. */
export function alertKey(advice: Advice[], active: boolean): string {
  if (!active) return "closed";
  const items = advice.filter((a) => a.level !== "ok").map((a) => `${a.level}:${a.title}`).sort();
  return items.length ? items.join("|") : "ok";
}

/** Telegram HTML for one watched trove. Everything that comes from data is escaped. */
export function alertText(address: string, view: TroveView, advice: Advice[], origin: string): string {
  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
  const head = `<b>MUSD Compass</b> · <code>${esc(short)}</code>`;
  if (!view.active) return `${head}\nThere is no open trove at this address now.`;
  const open = advice.filter((a) => a.level !== "ok");
  if (!open.length) {
    return `${head}\nAll clear. Your ratio is ${n(view.icrPct)}% and nothing needs doing.\n<a href="${esc(origin)}/trove?address=${esc(address)}">See your trove</a>`;
  }
  const lines = open.map((a) => `<b>${esc(a.title)}</b>\n${esc(a.detail)}`).join("\n\n");
  return `${head}\n${lines}\n\n<a href="${esc(origin)}/trove?address=${esc(address)}">See your trove</a> · Add BTC or repay MUSD in the Mezo app: https://mezo.org`;
}

/** The HTTP status Telegram answered with, or 0 when there is no token, the request failed or it timed out. A 403 means the user blocked the bot. */
export async function sendTelegramStatus(chatId: number, html: string): Promise<number> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return 0;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.status;
  } catch {
    return 0;
  }
}

/** true on 2xx. */
export async function sendTelegram(chatId: number, html: string): Promise<boolean> {
  const s = await sendTelegramStatus(chatId, html);
  return s >= 200 && s < 300;
}
