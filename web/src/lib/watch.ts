import { pipeline, redis, storeConfigured } from "@/lib/store";

// Alerts need the chat id and the address, so they are stored here and never shown anywhere.
export const MAX_PER_CHAT = 3;
export const MAX_TOTAL = 500;
const chatKey = (chatId: number) => `watch:chat:${chatId}`;
const stateKey = (chatId: number, address: string) => `watch:state:${chatId}|${address.toLowerCase()}`;
const ALL = "watch:all";

export async function addWatch(chatId: number, address: string): Promise<"added" | "exists" | "limit" | "full" | "off"> {
  if (!storeConfigured()) return "off";
  const a = address.toLowerCase();
  const r = await pipeline([["SISMEMBER", chatKey(chatId), a], ["SCARD", chatKey(chatId)], ["SCARD", ALL]]);
  if (!r) return "off";
  if (r[0] === 1) return "exists";
  if (Number(r[1]) >= MAX_PER_CHAT) return "limit";
  if (Number(r[2]) >= MAX_TOTAL) return "full";
  const w = await pipeline([["SADD", chatKey(chatId), a], ["SADD", ALL, `${chatId}|${a}`]]);
  return w ? "added" : "off";
}

export async function removeWatch(chatId: number, address: string): Promise<boolean> {
  if (!storeConfigured()) return false;
  const a = address.toLowerCase();
  const r = await pipeline([["SREM", chatKey(chatId), a], ["SREM", ALL, `${chatId}|${a}`], ["DEL", stateKey(chatId, a)]]);
  return r?.[0] === 1;
}

export async function listWatches(chatId: number): Promise<string[]> {
  const r = await redis("SMEMBERS", chatKey(chatId));
  return Array.isArray(r) ? (r as string[]).sort() : [];
}

export async function allWatches(): Promise<{ chatId: number; address: string }[]> {
  const r = await redis("SMEMBERS", ALL);
  if (!Array.isArray(r)) return [];
  return (r as string[]).map((m) => {
    const [chatId, address] = m.split("|");
    return { chatId: Number(chatId), address };
  });
}

/** The last advice key sent for this watch, so an unchanged advice is not sent twice. */
export async function getState(chatId: number, address: string): Promise<string | null> {
  const r = await redis("GET", stateKey(chatId, address));
  return typeof r === "string" ? r : null;
}

export async function setState(chatId: number, address: string, key: string): Promise<void> {
  await redis("SET", stateKey(chatId, address), key);
}
