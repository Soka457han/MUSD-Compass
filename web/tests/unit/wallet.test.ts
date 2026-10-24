import { describe, expect, it } from "vitest";
import { humanError } from "@/lib/wallet";

describe("humanError", () => {
  it("turns wallet rejections and ERC-20 custom errors into words", () => {
    expect(humanError({ code: 4001, message: "User rejected the request." })).toMatch(/cancelled/);
    expect(humanError({ shortMessage: 'The contract function "deposit" reverted with the following signature:\n0xfb8f41b2' })).toMatch(/approve first/);
    expect(humanError({ shortMessage: "reverted with the following signature: 0xe450d38c" })).toMatch(/Not enough MUSD/);
    expect(humanError({ shortMessage: "Something odd\nmore detail" })).toBe("Something odd");
  });
});
