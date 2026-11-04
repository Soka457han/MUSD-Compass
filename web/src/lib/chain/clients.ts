import { createPublicClient, fallback, http } from "viem";
import { mainnet, mezo, mezoTestnet } from "viem/chains";

// Env defaults mirror .env.example. viem's built-in Mezo RPC (rpc.mezo.org) failed our check, so it is never used.
const env = {
  mezo: process.env.MEZO_MAINNET_RPC ?? "https://rpc-http.mezo.boar.network",
  mezoFallback: process.env.MEZO_MAINNET_RPC_FALLBACK ?? "https://mainnet.mezo.public.validationcloud.io",
  mezoTestnet: process.env.MEZO_TESTNET_RPC ?? "https://rpc.test.mezo.org",
  ethereum: process.env.ETHEREUM_RPC ?? "https://ethereum-rpc.publicnode.com",
};

export const rpcUrls = env;

// Boar allows 10 HTTP requests/s per IP but accepts JSON-RPC batches (40 calls in one request checked 24 Oct),
// so calls made within 16 ms go out as one request. Source: https://viem.sh/docs/clients/transports/http
const mezoHttp = (url: string) => http(url, { batch: { wait: 16 }, retryCount: 5, retryDelay: 400 });

// Source: https://viem.sh/docs/clients/transports/fallback
export const mezoClient = createPublicClient({
  chain: mezo,
  transport: fallback([mezoHttp(env.mezo), mezoHttp(env.mezoFallback)]),
});

// The sMUSD log scan gets its own client: eth_getLogs over 10k blocks takes 2 to 10 s on Boar (measured 4 Nov 2026), so batched
// together they passed viem's 10 s default timeout and retried until the 60 s function limit; batched with them, every other
// Mezo read waited too. Validation Cloud goes first here: the same 34-request, 14-day scan, 8 at a time, took 7 s there with
// no errors and the same 9 events, against 37 s on Boar. Boar stays as the fallback. Both cap a request at 10,000 blocks.
const mezoLogsHttp = (url: string) => http(url, { timeout: 30_000, retryCount: 2, retryDelay: 400 });
export const mezoLogsClient = createPublicClient({
  chain: mezo,
  transport: fallback([mezoLogsHttp(env.mezoFallback), mezoLogsHttp(env.mezo)]),
});

export const mezoTestnetClient = createPublicClient({ chain: mezoTestnet, transport: mezoHttp(env.mezoTestnet) });

export const ethereumClient = createPublicClient({ chain: mainnet, transport: http(env.ethereum) });
