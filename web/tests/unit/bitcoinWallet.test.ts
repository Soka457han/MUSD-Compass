import { describe, expect, it, vi } from "vitest";
import { hash160Hex, keyHash, mezoAccountFor, bitcoinAccount, detectBitcoinWallets, mezoAccountFromKeyHash } from "@/lib/bitcoinWallet";

// Vectors from @mezo-org/orangekit-smart-account@1.0.0-beta.24 tests (predictOrangeKitAddress.test.ts, bitcoin/tests/data.ts).
// Their comment says the key-hash vectors were produced by the factory's on-chain predictAddresses.
const KEY_HASH_VECTORS: [string, string][] = [
  ["0x0000000000000000000000000000000000000000", "0xd84C120D84CC795F9b5649594B916A961C64f387"],
  ["0xffffffffffffffffffffffffffffffffffffffff", "0x1Ae9407f0FA2f165cC28767750bBCd0219540c62"],
  ["0x0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f", "0x16608714812c0FB4Bb94cCb4A2c27BEE95E32432"],
  ["0x1234567890abcdef1234567890abcdef12345678", "0xc6Dc4b63f691de9ec6E495Fe3b1207C1CABa5370"],
  ["0x00000000000000000000000000000000000000ff", "0xF3cD2c9660B19F68d9F4CD99Be10C057ed3A766A"],
  ["0xffffffff00000000000000000000000000000000", "0xC5d7e7a75527302521aeCfE6Acb38806c49ABF1A"],
];

describe("mezoAccountFromKeyHash", () => {
  it.each(KEY_HASH_VECTORS)("maps %s to the Safe the factory predicts", (h, safe) => {
    expect(mezoAccountFromKeyHash(h as `0x${string}`)).toBe(safe);
  });
});

describe("keyHash", () => {
  it("reads the key hash out of a native SegWit address (mainnet and testnet)", () => {
    expect(keyHash("bc1qr2gzwarzhv2r2r70v7522w67rt8n6azcklup4z")).toBe(hash160Hex("0x0301c3a0b3e1a18d0e04a455e2fbed97d97352cfc35ad272cdc8dcb0fc8dee6707"));
    expect(keyHash("tb1qhp6ug4hp3cc84spx3l8sddh8w5ffjujvjycqv5")).toBe(hash160Hex("0x03470e65b45464f6945d7a4434cec1d1df61700f21bf0520f0171cfdab313eeaae"));
  });
  it("reads the key hash out of a legacy address (mainnet and testnet)", () => {
    expect(keyHash("15db8HU8AhNaZpX2efV5H5fvJcqmLEgxBB")).toBe(hash160Hex("0x03d8d91c7e4eb085e2552aa925607f4b622d703df66ab415d916ad90dac1d44369"));
    expect(keyHash("mpPNkDrN1jReLUpak261U9Mdobk5GZP7U8")).toBe(hash160Hex("0x0271bbca50d36cf169daecb18ad565de1c4be9231575df57f730ec95d3d86b409f"));
  });
  it("takes a nested SegWit address only when the public key proves it wraps that key", () => {
    const pk = "0385a365b47f35aff49fdf53cd0b31ab25dec1ef7a4ee3c9d3060ff298ba448d71";
    const script = hash160Hex(`0x0014${hash160Hex(`0x${pk}`).slice(2)}`);
    expect(keyHash("3PqcLLkJ2CDrCXpNbfdmkkPN8PUibE9EVG", pk)).toBe(script);
    expect(() => keyHash("3PqcLLkJ2CDrCXpNbfdmkkPN8PUibE9EVG")).toThrow(/public key/);
    expect(() => keyHash("3PqcLLkJ2CDrCXpNbfdmkkPN8PUibE9EVG", "0301c3a0b3e1a18d0e04a455e2fbed97d97352cfc35ad272cdc8dcb0fc8dee6707")).toThrow(/public key/);
  });
  it("refuses Taproot and broken addresses instead of guessing", () => {
    expect(() => keyHash("bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297")).toThrow(/Taproot/);
    expect(() => keyHash("bc1qr2gzwarzhv2r2r70v7522w67rt8n6azcklup4y")).toThrow(); // bad checksum
    expect(() => keyHash("15db8HU8AhNaZpX2efV5H5fvJcqmLEgxBC")).toThrow(); // bad checksum
    expect(() => keyHash("hello")).toThrow();
  });
});

describe("mezoAccountFor", () => {
  it("matches the package's end-to-end vector (legacy testnet address)", () => {
    expect(mezoAccountFor("mv4rnyY3Su5gjcDNzbMLKBQkBicCtHUtFB")).toBe("0x6083Bde64CCBF08470a1a0dAa9a0281B4951be7C");
  });
});

const ADDR = "mv4rnyY3Su5gjcDNzbMLKBQkBicCtHUtFB";
const SAFE = "0x6083Bde64CCBF08470a1a0dAa9a0281B4951be7C";
const injectedBtc = () => ({ requestAccounts: vi.fn(async () => [ADDR]), getPublicKey: vi.fn(async () => "02aa") });

describe("detectBitcoinWallets", () => {
  it("lists only the wallets this browser has", () => {
    expect(detectBitcoinWallets({} as never)).toEqual([]);
    expect(detectBitcoinWallets({ unisat: {}, okxwallet: { bitcoin: {} }, XverseProviders: { BitcoinProvider: {} } } as never)).toEqual(["unisat", "okx", "xverse"]);
    expect(detectBitcoinWallets({ okxwallet: {} } as never)).toEqual([]); // OKX without its Bitcoin side
  });
});

describe("bitcoinAccount", () => {
  it("asks Unisat for its address and returns the Mezo account", async () => {
    const unisat = injectedBtc();
    await expect(bitcoinAccount("unisat", { unisat } as never)).resolves.toEqual({ bitcoinAddress: ADDR, account: SAFE });
    expect(unisat.requestAccounts).toHaveBeenCalled();
  });
  it("uses the Bitcoin side of OKX Wallet", async () => {
    const bitcoin = injectedBtc();
    await expect(bitcoinAccount("okx", { okxwallet: { bitcoin } } as never)).resolves.toEqual({ bitcoinAddress: ADDR, account: SAFE });
  });
  it("asks Xverse for permission, then for its payment address", async () => {
    const request = vi.fn<(method: string, params?: unknown) => Promise<unknown>>(async (method) =>
      method === "getAddresses"
        ? { jsonrpc: "2.0", id: "1", result: { addresses: [{ address: "bc1pzzz", publicKey: "", purpose: "ordinals" }, { address: ADDR, publicKey: "02aa", purpose: "payment" }] } }
        : { jsonrpc: "2.0", id: "1", result: true },
    );
    await expect(bitcoinAccount("xverse", { XverseProviders: { BitcoinProvider: { request } } } as never)).resolves.toEqual({ bitcoinAddress: ADDR, account: SAFE });
    expect(request.mock.calls.map((c) => c[0])).toEqual(["wallet_requestPermissions", "getAddresses"]);
    expect(request.mock.calls[1][1]).toMatchObject({ purposes: ["payment"] });
  });
  it("turns an Xverse refusal into the usual cancelled error", async () => {
    const request = vi.fn(async () => ({ jsonrpc: "2.0", id: "1", error: { code: 4001, message: "User rejected" } }));
    await expect(bitcoinAccount("xverse", { XverseProviders: { BitcoinProvider: { request } } } as never)).rejects.toMatchObject({ code: 4001 });
  });
  it("says so when the wallet is not installed", async () => {
    await expect(bitcoinAccount("unisat", {} as never)).rejects.toThrow(/Unisat is not installed/);
  });
});

describe("review fixes", () => {
  it("refuses an oversized address before decoding it", () => {
    expect(() => keyHash("1".repeat(5000))).toThrow(/not a Bitcoin address/);
  });
});
