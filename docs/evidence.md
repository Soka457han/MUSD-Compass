# Evidence

Every on-chain action Compass has taken, in one place. All writes are on Mezo testnet (chain 31611), sent from the user's own wallet straight to Mezo's contracts. Compass deploys no contract and holds no funds.

## Testnet transactions

| # | What | Amount | From | Transaction |
|---|---|---|---|---|
| 1 | Approve the Savings Vault (exact amount, not unlimited) | 100 MUSD | dev wallet `0xfe21…676C` | [`0xa5ec9c45…570f`](https://explorer.test.mezo.org/tx/0xa5ec9c450e27dfac27fb18f2ad91d2cdd5e2a1c782472108be93126766b1570f) |
| 2 | Deposit into the Savings Vault | 100 MUSD → 100 sMUSD | dev wallet | [`0x1f4ddeb6…8f3c`](https://explorer.test.mezo.org/tx/0x1f4ddeb61396464e32ee63806a35a3e5cf8cb9218613880e24a5324293458f3c) |
| 3 | Withdraw (also pays any pending yield) | 10 MUSD | dev wallet | [`0x3045fba8…77cf`](https://explorer.test.mezo.org/tx/0x3045fba85e8551ca6a465567911f96b68ded7a336f99640c51b3104525f777cf) |
| 4 | x402 payment for `/api/premium/yields` (facilitator sent it and paid gas; Permit2 approval exactly 0.001) | 0.001 MUSD | dev wallet (payer = payee) | [`0x0454c620…4997`](https://explorer.test.mezo.org/tx/0x0454c620d5b02fa6dd9ba0fb3f6665894498d15b825cf8730ff47a0683fa4997) |
| 5 | x402 payment from a second wallet (payer ≠ payee) | 0.001 MUSD | TODO | TODO |
| 6 | Open a trove, then deposit the borrowed MUSD (Borrow → Earn on `/vault`) | TODO | TODO | TODO |
| 7 | Claim yield after a distribution (26 Oct) | 0.1031 MUSD | dev wallet | [`0xe79ae272…7734`](https://explorer.test.mezo.org/tx/0xe79ae272024d2fe8998a1891ad07166d9a72c8093e17fdf7d6cee8007d6f7734) |

## How to add the missing rows

- **Row 5:** in a second wallet, get test MUSD ([`/get-test-musd`](https://musd-compass.vercel.app/get-test-musd)), open [`/developers`](https://musd-compass.vercel.app/developers) and press *Pay 0.001 MUSD & fetch*. The payee is the dev wallet, so the payer is now someone else.
- **Row 6:** on [`/vault`](https://musd-compass.vercel.app/vault), connect a wallet with test BTC and press *Borrow … MUSD and deposit it*. Three prompts: `openTrove` (locks BTC for a 200% ratio), an exact approval, the deposit. 1,800 MUSD needs about 0.0499 BTC at the testnet price on 26 Oct.

## Safety, checkable without a wallet

[`/vault`](https://musd-compass.vercel.app/vault) → *Try to break it* runs three attacks for real:

- an unlimited MUSD approval: refused by Compass's guard before any wallet is asked;
- a transaction to a contract that is not on the allowlist: refused the same way;
- depositing 1,000,000 MUSD from the sample wallet: Mezo testnet refuses it in simulation, the same simulation every real deposit goes through.

Guard code: [`web/src/lib/sendSafely.ts`](../web/src/lib/sendSafely.ts). The allowlist is testnet MUSD, sMUSD and BorrowerOperations (`openTrove` only); approvals go only to the vault and never for an unlimited amount.

## Live numbers checked against their source (26 Oct 2026)

- Savings Vault gauge: `rewardRate` 0.4425 MEZO/s over 5,309,027 staked sMUSD at MEZO $0.005276 = 1.39% a year; the Mezo app shows 1.38%. Staking hands the vault's savings yield to veBTC voters (Mezo docs, Earn → Vaults).
- Mezo pool rates are not shown yet: the Mezo app showed mUSDC/MUSD-10 at 0.09% fees or 1.81% MEZO staked on 26 Oct, below the Savings Vault's 4.01%.
- Testnet trove inputs read from BorrowerOperations: minimum net debt 1,800 MUSD, fee 0.1%, gas compensation 200 MUSD; `openTrove(1800 MUSD)` with 0.04 BTC simulates successfully.
