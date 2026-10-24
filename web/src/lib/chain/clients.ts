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

// Source: https://viem.sh/docs/clients/transports/fallback
export const mezoClient = createPublicClient({
  chain: mezo,
  transport: fallback([http(env.mezo), http(env.mezoFallback)]),
});

export const mezoTestnetClient = createPublicClient({ chain: mezoTestnet, transport: http(env.mezoTestnet) });

export const ethereumClient = createPublicClient({ chain: mainnet, transport: http(env.ethereum) });
