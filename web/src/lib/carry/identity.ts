// Identity guard (design §4): Mezo MUSD is matched by chain + address, never by symbol.
const MUSD = "0xdd468a1ddc392dcdbef6db6e34e89aa338f9f186"; // same address on Mezo, Ethereum, Base
const MUSD_TESTNET = "0x118917a40faf1cd7a13db0ef56c86de7973ac503";

const MUSD_BY_CHAIN: Record<number, string> = { 31612: MUSD, 1: MUSD, 8453: MUSD, 31611: MUSD_TESTNET };

export function isMezoMusd(chainId: number, address: string): boolean {
  return MUSD_BY_CHAIN[chainId] === address.toLowerCase();
}
