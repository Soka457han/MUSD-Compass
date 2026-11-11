// Every on-chain transaction Compass has sent. Source of truth: docs/evidence.md.
export type ProofTx = { what: string; amount: string; from: string; hash: `0x${string}`; date?: string };

export const TESTNET_PROOF: ProofTx[] = [
  { what: "Approve the Savings Vault (exact amount, not unlimited)", amount: "100 MUSD", from: "dev wallet 0xfe21…676C", hash: "0xa5ec9c450e27dfac27fb18f2ad91d2cdd5e2a1c782472108be93126766b1570f" },
  { what: "Deposit into the Savings Vault", amount: "100 MUSD → 100 sMUSD", from: "dev wallet", hash: "0x1f4ddeb61396464e32ee63806a35a3e5cf8cb9218613880e24a5324293458f3c" },
  { what: "Withdraw (also pays any pending yield)", amount: "10 MUSD", from: "dev wallet", hash: "0x3045fba85e8551ca6a465567911f96b68ded7a336f99640c51b3104525f777cf" },
  { what: "x402 payment for /api/premium/yields (facilitator sent it and paid gas; Permit2 approval exactly 0.001)", amount: "0.001 MUSD", from: "dev wallet (payer = payee)", hash: "0x0454c620d5b02fa6dd9ba0fb3f6665894498d15b825cf8730ff47a0683fa4997" },
  { what: "x402 payment from a second wallet (payer is not the payee)", amount: "0.001 MUSD", from: "0xC20F…9C4C to dev wallet", hash: "0x3a63cdf86569c3787867fcc9ddb3ebf8c91eb8dec1a2a206c716457f8c30bc5a" },
  { what: "Borrow → Earn: openTrove with test BTC", amount: "1,800 MUSD borrowed", from: "dev wallet", hash: "0x82f0ddf6fd1598a1a89eaf3652f69323e5fdc69151ef08209e6c5a5e8ed81fe0" },
  { what: "Borrow → Earn: exact approval", amount: "1,800 MUSD", from: "dev wallet", hash: "0xafbff33ad670be5565928aaf481e6e6159d55a9d510cca06627d43ccc1fd641d" },
  { what: "Borrow → Earn: deposit into the Savings Vault", amount: "1,800 MUSD → 1,800 sMUSD", from: "dev wallet", hash: "0x53da2a8307efecc5d71eaeda40dfd172f43be82a05ef7f3c55168917c34ea135" },
  { what: "Claim yield after a distribution (26 Oct)", amount: "0.1031 MUSD", from: "dev wallet", hash: "0xe79ae272024d2fe8998a1891ad07166d9a72c8093e17fdf7d6cee8007d6f7734" },
];

// The owner adds entries here after each real mainnet transaction.
export const MAINNET_PROOF: ProofTx[] = [];

export const explorerTxUrl = (hash: string, network: "testnet" | "mainnet") =>
  `${network === "testnet" ? "https://explorer.test.mezo.org" : "https://explorer.mezo.org"}/tx/${hash}`;
