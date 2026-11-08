import { isBot } from "@/lib/rateLimit";
import { addWatch, listWatches, removeWatch } from "@/lib/watch";
import { isWallet } from "@/lib/vault";

const HEADERS = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: HEADERS });

/** Bot-only: subscribe, unsubscribe or list a chat's watched trove addresses. */
export async function POST(req: Request) {
  if (!isBot(req)) return fail("Unauthorized.", 401);
  let body: { chatId?: unknown; action?: unknown; address?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("Body must be JSON.", 400);
  }
  if (!body || typeof body !== "object") return fail("Body must be JSON.", 400);
  const { chatId, action, address } = body;
  if (typeof chatId !== "number" || !Number.isSafeInteger(chatId)) return fail("chatId must be an integer.", 400);
  if (action === "list") return Response.json({ addresses: await listWatches(chatId) }, { headers: HEADERS });
  if (action !== "add" && action !== "remove") return fail("Unknown action.", 400);
  if (typeof address !== "string" || !isWallet(address)) return fail("That is not an EVM address (0x… with 40 hex characters).", 400);
  if (action === "add") return Response.json({ status: await addWatch(chatId, address) }, { headers: HEADERS });
  return Response.json({ removed: await removeWatch(chatId, address) }, { headers: HEADERS });
}
