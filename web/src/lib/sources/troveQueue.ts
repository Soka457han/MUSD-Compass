import { cacheLife } from "next/cache";
import type { PublicClient } from "viem";
import { mezoClient } from "@/lib/chain/clients";
import { readNominalIcrs } from "@/lib/trove";

/** Every active trove's nominal ICR, shared across instances for 5 minutes (strings: cache-safe). */
export async function fetchTroveQueue(): Promise<string[]> {
  "use cache: remote";
  cacheLife({ revalidate: 300, expire: 3600 });
  return (await readNominalIcrs(mezoClient as PublicClient)).map(String);
}
