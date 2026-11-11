import { base58check, bech32 } from "@scure/base";
import { bytesToHex, getAddress, getContractAddress, keccak256, ripemd160, sha256, type Address, type Hex } from "viem";

/**
 * A Bitcoin wallet on Mezo acts through a "Mezo Passport" account: a Safe whose address comes from the wallet's
 * 20-byte key hash by CREATE2 at Mezo's OrangeKit factory. This file only works out that address (view only).
 * Written from the public formula; no OrangeKit (GPL-3.0) code is used.
 */

// Verified on chain 11 Nov 2026 (predictAddresses(bytes20) on the factory, Mezo mainnet and testnet, two vectors): OrangeKitSafeFactory and its Safe init-code hash, as published in @mezo-org/orangekit-contracts@1.0.0-beta.6
// (deployments/mainnet + matsnet) and @mezo-org/orangekit-smart-account@1.0.0-beta.24 (predictOrangeKitAddress.ts).
// Check on chains 31611 and 31612: predictAddresses(bytes20 0x00…00) at the factory must return 0xd84C120D84CC795F9b5649594B916A961C64f387.
export const ORANGEKIT_FACTORY = {
  address: "0x7E80bd5A2E8Fca0B160254D43aC9f43AC2cC1052",
  safeInitCodeHash: "0x2ebd335f0ee339c4d1338b7275d9b30185802a35ba476be7906f8fb67cfe6e96",
} as const;

export const hash160Hex = (hex: Hex): Hex => ripemd160(sha256(hex));

/** The Mezo account (Safe) for a 20-byte Bitcoin key hash: CREATE2 with salt keccak256(keyHash). */
export const mezoAccountFromKeyHash = (h: Hex): Address =>
  getAddress(getContractAddress({ opcode: "CREATE2", from: ORANGEKIT_FACTORY.address, salt: keccak256(h), bytecodeHash: ORANGEKIT_FACTORY.safeInitCodeHash }));

const b58 = base58check((b: Uint8Array) => sha256(b, "bytes"));

/**
 * The 20-byte hash a Mezo account is keyed on. Only the address types Mezo accounts support:
 * native SegWit (bc1q/tb1q: the key hash), legacy (1/m/n: the key hash), nested SegWit (3/2: the script hash,
 * accepted only when the public key proves the script wraps that key, since a 3… address can hide any script).
 */
export function keyHash(address: string, publicKey?: string): Hex {
  const a = address.trim();
  if (a.length > 100) throw new Error("That is not a Bitcoin address."); // base58 decoding is quadratic; a real address is under 100 characters
  const lower = a.toLowerCase();
  if (/^(bc|tb)1p/.test(lower)) throw new Error("Taproot addresses (bc1p) have no Mezo account. In your wallet, switch to a Native SegWit (bc1q) or Nested SegWit (3…) address.");
  if (/^(bc|tb)1q/.test(lower)) {
    const { prefix, words } = bech32.decode(lower as `${string}1${string}`);
    const program = bech32.fromWords(words.slice(1));
    if ((prefix !== "bc" && prefix !== "tb") || words[0] !== 0 || program.length !== 20) throw new Error("This SegWit address type has no Mezo account.");
    return bytesToHex(program);
  }
  const raw = b58.decode(a); // throws on a bad checksum
  if (raw.length !== 21) throw new Error("Not a Bitcoin address.");
  const [version, hash] = [raw[0], bytesToHex(raw.slice(1))];
  if (version === 0x00 || version === 0x6f) return hash; // P2PKH mainnet / testnet
  if (version === 0x05 || version === 0xc4) {
    const pk = (publicKey ?? "").replace(/^0x/, "");
    const wraps = /^0[23][0-9a-fA-F]{64}$/.test(pk) && hash160Hex(`0x0014${hash160Hex(`0x${pk}`).slice(2)}`) === hash;
    if (!wraps) throw new Error("This 3… address does not match the wallet's public key, so its Mezo account can't be worked out.");
    return hash;
  }
  throw new Error("Not a supported Bitcoin address.");
}

export const mezoAccountFor = (address: string, publicKey?: string): Address => mezoAccountFromKeyHash(keyHash(address, publicKey));

export type BitcoinWalletId = "unisat" | "okx" | "xverse";
export const BITCOIN_WALLETS: { id: BitcoinWalletId; name: string }[] = [
  { id: "unisat", name: "Unisat" },
  { id: "okx", name: "OKX (Bitcoin)" },
  { id: "xverse", name: "Xverse" },
];

// The injected APIs OrangeKit itself calls (orangekit@1.0.0-beta.40 src/wallet/utils.ts, bitcoin-wallet-provider.ts, xverse/provider.ts).
type Injected = { requestAccounts(): Promise<string[]>; getPublicKey(): Promise<string> };
type XverseRpc = { request(method: string, params: unknown): Promise<{ result?: unknown; error?: { code: number; message: string } }> };
type BtcWindow = { unisat?: Injected; okxwallet?: { bitcoin?: Injected }; XverseProviders?: { BitcoinProvider?: XverseRpc } };

const injectedFor = (id: BitcoinWalletId, w: BtcWindow) =>
  id === "unisat" ? w.unisat : id === "okx" ? w.okxwallet?.bitcoin : w.XverseProviders?.BitcoinProvider;

export const detectBitcoinWallets = (w: BtcWindow = window as BtcWindow): BitcoinWalletId[] => BITCOIN_WALLETS.map((x) => x.id).filter((id) => injectedFor(id, w));

async function xverse(p: XverseRpc, method: string, params: unknown) {
  const r = await p.request(method, params);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
  return r.result;
}

/** Asks the Bitcoin wallet for its address (one wallet prompt) and works out its Mezo account. Nothing is signed. */
export async function bitcoinAccount(id: BitcoinWalletId, w: BtcWindow = window as BtcWindow): Promise<{ bitcoinAddress: string; account: Address }> {
  const p = injectedFor(id, w);
  if (!p) throw new Error(`${BITCOIN_WALLETS.find((x) => x.id === id)!.name} is not installed in this browser.`);
  let address: string | undefined;
  let publicKey: string | undefined;
  if (id === "xverse") {
    const x = p as XverseRpc;
    await xverse(x, "wallet_requestPermissions", undefined);
    const r = (await xverse(x, "getAddresses", { purposes: ["payment"], message: "Show your Mezo account on MUSD Compass" })) as { addresses: { address: string; publicKey: string; purpose?: string }[] };
    const pay = r.addresses.find((a) => a.purpose === "payment") ?? r.addresses[0];
    [address, publicKey] = [pay?.address, pay?.publicKey];
  } else {
    const i = p as Injected;
    [address] = await i.requestAccounts();
    publicKey = await i.getPublicKey();
  }
  if (!address) throw new Error("The wallet returned no Bitcoin address.");
  return { bitcoinAddress: address, account: mezoAccountFor(address, publicKey) };
}
