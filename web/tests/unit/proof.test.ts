import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { explorerTxUrl, MAINNET_PROOF, TESTNET_PROOF } from "@/lib/proof";

const evidence = readFileSync(join(__dirname, "../../../docs/evidence.md"), "utf8");
const HASH = /^0x[0-9a-f]{64}$/;

describe("proof", () => {
  it("has the 9 testnet rows with full, unique hashes", () => {
    expect(TESTNET_PROOF).toHaveLength(9);
    const hashes = TESTNET_PROOF.map((t) => t.hash);
    for (const h of hashes) expect(h).toMatch(HASH);
    expect(new Set(hashes).size).toBe(9);
  });
  it("every hash is in docs/evidence.md", () => {
    for (const t of TESTNET_PROOF) expect(evidence).toContain(`/tx/${t.hash}`);
  });
  it("builds explorer URLs", () => {
    const h = TESTNET_PROOF[0].hash;
    expect(explorerTxUrl(h, "testnet")).toBe(`https://explorer.test.mezo.org/tx/${h}`);
    expect(explorerTxUrl(h, "mainnet")).toBe(`https://explorer.mezo.org/tx/${h}`);
  });
  it("has the 8 mainnet rows with full, unique hashes, all in docs/evidence.md", () => {
    expect(MAINNET_PROOF).toHaveLength(8);
    expect(new Set(MAINNET_PROOF.map((t) => t.hash)).size).toBe(8);
    for (const t of MAINNET_PROOF) {
      expect(t.hash).toMatch(HASH);
      expect(evidence).toContain(`explorer.mezo.org/tx/${t.hash}`);
    }
  });
});
