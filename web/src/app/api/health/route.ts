import { connection } from "next/server";
import { createPublicClient, http } from "viem";
import { mezo } from "viem/chains";
import { ethereumClient, mezoTestnetClient, rpcUrls } from "@/lib/chain/clients";

// Deployment check (verification log #27): can this host reach every upstream we read?
async function check(name: string, run: () => Promise<unknown>) {
  const t = Date.now();
  try {
    return { name, ok: true, value: String(await run()), ms: Date.now() - t };
  } catch (e) {
    return { name, ok: false, error: e instanceof Error ? e.message.slice(0, 160) : String(e), ms: Date.now() - t };
  }
}

const single = (url: string) => createPublicClient({ chain: mezo, transport: http(url) });

export async function GET() {
  await connection(); // always run at request time
  const results = await Promise.all([
    check("mezo-mainnet", () => single(rpcUrls.mezo).getBlockNumber()),
    check("mezo-mainnet-fallback", () => single(rpcUrls.mezoFallback).getBlockNumber()),
    check("mezo-testnet", () => mezoTestnetClient.getBlockNumber()),
    check("ethereum-gas-gwei", async () => Number(await ethereumClient.getGasPrice()) / 1e9),
    check("merkl", async () => {
      const r = await fetch("https://api.merkl.xyz/v4/tokens?chainId=31612&symbol=MEZO");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const [token] = (await r.json()) as { price: number }[];
      return `MEZO $${token?.price}`;
    }),
  ]);
  const ok = results.every((r) => r.ok);
  return Response.json({ ok, checkedAt: new Date().toISOString(), results }, { status: ok ? 200 : 503 });
}
