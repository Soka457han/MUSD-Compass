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

// Mezo mainnet (chain 31612), 12 Nov 2026, 17:34 to 17:42 UTC, one wallet. Each row was checked on chain: status success, 5 MUSD (0x4563918244f40000), selector matches the label.
const W = "wallet 0x9126…6976";
const D = "12 Nov 2026";
export const MAINNET_PROOF: ProofTx[] = [
  { what: "Approve the Savings Vault (exact amount, not unlimited)", amount: "5 MUSD", from: W, date: D, hash: "0xa62ad1e79c9ed6eaae5cf107b28663894695678c51b4c7d87c16a0a6119b7c5d" },
  { what: "Deposit into the Savings Vault", amount: "5 MUSD → 5 sMUSD", from: W, date: D, hash: "0x3bb81d682918f0312f7bbebd6a26611e076a9dc973e1008b2ff98330f876b1c9" },
  { what: "Approve the sMUSD gauge (exact amount)", amount: "5 sMUSD", from: W, date: D, hash: "0x9c6f43f75fdb200c94345e7bcfe1ae97d00018cc8897bc5bef2b114a5bcd63e5" },
  { what: "Stake sMUSD in the gauge", amount: "5 sMUSD", from: W, date: D, hash: "0x767c7cce3f02e4cd4b6f72b6d18e2a751356dde4792f2e93ab1e50a93725599f" },
  { what: "Unstake sMUSD from the gauge", amount: "5 sMUSD", from: W, date: D, hash: "0x5f1fcf9b7828ad10e169cb6f83c8002dfd3b0b11295fe01c605ba0b10e95f8a0" },
  { what: "Claim MEZO from the gauge", amount: "gauge reward", from: W, date: D, hash: "0xf99b3d22d1f89ba1fb3214c23cfaff1b5709bdb702b0e75554a74e4b89f6e75b" },
  { what: "Claim vault yield (nothing was due yet, so no MUSD moved)", amount: "0 MUSD", from: W, date: D, hash: "0x5a2f84c4c051957587050c812ae17aa0f9592dfd4eab12996c7b0e583d9c387c" },
  { what: "Withdraw from the Savings Vault", amount: "5 sMUSD → 5 MUSD", from: W, date: D, hash: "0xd6c84c65ddacef5e52f1411c5f1cb21ca122e74d7abce9831372230527954543" },
];

export const explorerTxUrl = (hash: string, network: "testnet" | "mainnet") =>
  `${network === "testnet" ? "https://explorer.test.mezo.org" : "https://explorer.mezo.org"}/tx/${hash}`;
