import { connection } from "next/server";
import { createPublicClient, http } from "viem";
import { mezo } from "viem/chains";
import { ethereumClient, mezoTestnetClient, rpcUrls } from "@/lib/chain/clients";
import { check } from "@/lib/health";
import { allow } from "@/lib/rateLimit";

const single = (url: string) => createPublicClient({ chain: mezo, transport: http(url) });

export async function GET(req: Request) {
  await connection(); // always run at request time
  if (!allow(req)) return Response.json({ error: "Too many requests — try again in a minute." }, { status: 429 }); // each call fires 5 upstream requests
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
