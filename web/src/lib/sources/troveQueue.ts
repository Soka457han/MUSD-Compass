import { cacheLife } from "next/cache";
import type { PublicClient } from "viem";
import { mezoClient } from "@/lib/chain/clients";
import { readNominalIcrs } from "@/lib/trove";

/** Every active trove's nominal ICR, shared across instances for 5 minutes (strings: cache-safe). */
export async function fetchTroveQueue(): Promise<string[]> {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 86_400 }); // after 5 min a visit gets the cached copy at once and refreshes it in the background; only a full day without visits makes one wait
  return (await readNominalIcrs(mezoClient as PublicClient)).map(String);
}
