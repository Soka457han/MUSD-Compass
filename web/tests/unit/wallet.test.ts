import { describe, expect, it } from "vitest";
import { connect, explorerTx, humanError } from "@/lib/wallet";

describe("humanError", () => {
  it("turns wallet rejections and ERC-20 custom errors into words", () => {
    expect(humanError({ code: 4001, message: "User rejected the request." })).toMatch(/cancelled/);
    expect(humanError({ shortMessage: 'The contract function "deposit" reverted with the following signature:\n0xfb8f41b2' })).toMatch(/approve first/);
    expect(humanError({ shortMessage: "reverted with the following signature: 0xe450d38c" })).toMatch(/Not enough MUSD/);
    expect(humanError({ shortMessage: "Something odd\nmore detail" })).toBe("Something odd");
  });
});

describe("connect and explorerTx by network", () => {
  const acct = "0xfe21B2782B35BE770DD4a7b05f81cE43790D676C";
  /** A wallet on Mezo testnet (0x7b7b) that records what it is asked. */
  function fakeWallet() {
    const calls: { method: string; params?: unknown }[] = [];
    const provider = {
      request: async ({ method, params }: { method: string; params?: unknown }) => {
        calls.push({ method, params });
        if (method === "eth_requestAccounts") return [acct];
        if (method === "eth_chainId") return "0x7b7b";
        if (method === "wallet_switchEthereumChain") return null;
        throw new Error(`unexpected ${method}`);
      },
    };
    return { provider, calls };
  }

  it("asks the wallet for Mezo mainnet (chain 31612, 0x7b7c) when the action is on mainnet", async () => {
    const { provider, calls } = fakeWallet();
    const { account } = await connect(provider as never, "mainnet");
    expect(account).toBe(acct);
    expect(calls.find((c) => c.method === "wallet_switchEthereumChain")?.params).toEqual([{ chainId: "0x7b7c" }]);
  });
  it("stays on testnet (0x7b7b) by default, so nothing changes for existing callers", async () => {
    const { provider, calls } = fakeWallet();
    await connect(provider as never);
    expect(calls.some((c) => c.method === "wallet_switchEthereumChain")).toBe(false);
  });
  it("links each transaction to the explorer of its own network", () => {
    expect(explorerTx("0xabc")).toBe("https://explorer.test.mezo.org/tx/0xabc");
    expect(explorerTx("0xabc", "mainnet")).toBe("https://explorer.mezo.org/tx/0xabc");
  });
});

describe("humanError", () => {
  it("copes with a wallet that rejects with nothing", () => {
    expect(humanError(undefined)).toBe("Something went wrong.");
    expect(humanError(null)).toBe("Something went wrong.");
  });
});
