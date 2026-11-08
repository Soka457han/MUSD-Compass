# Evidence

Every on-chain action Compass has taken, in one place. All writes are on Mezo testnet (chain 31611), sent from the user's own wallet straight to Mezo's contracts. Compass deploys no contract and holds no funds.

## Testnet transactions

| # | What | Amount | From | Transaction |
|---|---|---|---|---|
| 1 | Approve the Savings Vault (exact amount, not unlimited) | 100 MUSD | dev wallet `0xfe21…676C` | [`0xa5ec9c45…570f`](https://explorer.test.mezo.org/tx/0xa5ec9c450e27dfac27fb18f2ad91d2cdd5e2a1c782472108be93126766b1570f) |
| 2 | Deposit into the Savings Vault | 100 MUSD → 100 sMUSD | dev wallet | [`0x1f4ddeb6…8f3c`](https://explorer.test.mezo.org/tx/0x1f4ddeb61396464e32ee63806a35a3e5cf8cb9218613880e24a5324293458f3c) |
| 3 | Withdraw (also pays any pending yield) | 10 MUSD | dev wallet | [`0x3045fba8…77cf`](https://explorer.test.mezo.org/tx/0x3045fba85e8551ca6a465567911f96b68ded7a336f99640c51b3104525f777cf) |
| 4 | x402 payment for `/api/premium/yields` (facilitator sent it and paid gas; Permit2 approval exactly 0.001) | 0.001 MUSD | dev wallet (payer = payee) | [`0x0454c620…4997`](https://explorer.test.mezo.org/tx/0x0454c620d5b02fa6dd9ba0fb3f6665894498d15b825cf8730ff47a0683fa4997) |
| 5 | x402 payment from a second wallet (payer ≠ payee) | 0.001 MUSD | `0xC20F…9C4C` → dev wallet | [`0x3a63cdf8…bc5a`](https://explorer.test.mezo.org/tx/0x3a63cdf86569c3787867fcc9ddb3ebf8c91eb8dec1a2a206c716457f8c30bc5a) |
| 6a | Borrow → Earn: `openTrove` with test BTC | 1,800 MUSD borrowed | dev wallet | [`0x82f0ddf6…1fe0`](https://explorer.test.mezo.org/tx/0x82f0ddf6fd1598a1a89eaf3652f69323e5fdc69151ef08209e6c5a5e8ed81fe0) |
| 6b | Borrow → Earn: exact approval | 1,800 MUSD | dev wallet | [`0xafbff33a…641d`](https://explorer.test.mezo.org/tx/0xafbff33ad670be5565928aaf481e6e6159d55a9d510cca06627d43ccc1fd641d) |
| 6c | Borrow → Earn: deposit into the Savings Vault | 1,800 MUSD → 1,800 sMUSD | dev wallet | [`0x53da2a83…a135`](https://explorer.test.mezo.org/tx/0x53da2a8307efecc5d71eaeda40dfd172f43be82a05ef7f3c55168917c34ea135) |
| 7 | Claim yield after a distribution (26 Oct) | 0.1031 MUSD | dev wallet | [`0xe79ae272…7734`](https://explorer.test.mezo.org/tx/0xe79ae272024d2fe8998a1891ad07166d9a72c8093e17fdf7d6cee8007d6f7734) |

## Safety, checkable without a wallet

[`/vault`](https://musd-compass.vercel.app/vault) → *Try to break it* runs three attacks for real:

- an unlimited MUSD approval: refused by Compass's guard before any wallet is asked;
- a transaction to a contract that is not on the allowlist: refused the same way;
- depositing 1,000,000 MUSD from the sample wallet: Mezo testnet refuses it in simulation, the same simulation every real deposit goes through.

Guard code: [`web/src/lib/sendSafely.ts`](../web/src/lib/sendSafely.ts). The allowlist is MUSD, sMUSD and BorrowerOperations on each network, and per contract only the functions Compass uses: MUSD `approve`; vault `deposit`, `withdraw`, `claimYield`; BorrowerOperations `openTrove`, `addColl`, `repayMUSD`. Approvals go only to the vault and never for an unlimited amount.

## Mezo mainnet dry run (simulated, not executed), 3 Nov 2026

No mainnet transaction has been sent. The dry run exercises Compass's own Borrow → Earn code against Mezo mainnet with read-only calls and `eth_call` simulation. Run it with `LIVE_MAINNET=1 npx vitest run tests/live` (it is skipped otherwise). It uses a dummy address with no funds and lends it 1 BTC inside the simulation only.

- For 2,000 MUSD of debt Compass computed 0.05707053 BTC of collateral (a 200% start at the BTC price read from PriceFeed that moment) and real HintHelpers hints: `0x593c…5bb5` and `0x467F…3Fb4`.
- The three steps (`openTrove`, an exact `approve`, `deposit`) pass Compass's guard on mainnet, and the price re-check before sending passes.
- `openTrove` with those hints and that collateral simulates successfully on mainnet.
- The same call with a third of the collateral is refused by the contract, so the simulation can fail.
- An exact approval of 1 MUSD to the mainnet vault simulates from a public MUSD holder (466.60 MUSD at the time).
- Not covered: the `deposit` step on mainnet (it needs MUSD the dummy does not have), and signing. The deposit function is the one used on testnet in the proof above.

## Live numbers checked against their source (26 Oct 2026)

- Savings Vault gauge: `rewardRate` 0.4425 MEZO/s over 5,309,027 staked sMUSD at MEZO $0.005276 = 1.39% a year; the Mezo app shows 1.38%. Staking hands the vault's savings yield to veBTC voters (Mezo docs, Earn → Vaults).
- Mezo pool rates are not shown yet: the Mezo app showed mUSDC/MUSD-10 at 0.09% fees or 1.81% MEZO staked on 26 Oct, below the Savings Vault's 4.01%.
- Testnet trove inputs read from BorrowerOperations: minimum net debt 1,800 MUSD, fee 0.1%, gas compensation 200 MUSD; `openTrove(1800 MUSD)` with 0.04 BTC simulates successfully.

## MUSD peg and redemption floor, 8 Nov 2026

Two reads on Mezo mainnet (chain 31612) through `https://rpc-http.mezo.boar.network`, block 13087631 (8 Nov 2026, about 13:39 UTC). Full notes: `docs/research/2026-11-wave2b-venues-peg.md`.

- Redemption fee: BorrowerOperations `0x44b1bac67dDA612a41a58AAf779143B181dEe031`, `redemptionRate()` returns 0.0075 (0.75%), so the floor is 1 - 0.0075 = $0.9925. Source: `mezo-org/musd` `solidity/contracts/BorrowerOperations.sol`.
- Market price: MUSD/mUSDC pool `0xcc372b7e15535ab225fe17c1075831d38ef7ac1a`, `slot0()` `sqrtPriceX96 = 79573356042004189394853931856270274`, i.e. 1.00874 MUSD per mUSDC, so MUSD is about $0.9913 with mUSDC counted as $1 (an assumption, stated next to the number on screen).
- Mezo's docs (https://mezo.org/docs/users/musd) say redemption is profitable until MUSD reaches $0.995. They do not show that arithmetic, so Compass shows the on-chain figure.

## Serving cost estimate for the premium endpoint, 8 Nov 2026

This is an estimate, not a bill. Source: https://vercel.com/docs/functions/usage-and-pricing (read 8 Nov 2026). Fluid compute, region iad1 (this project's region), Pro on-demand: Active CPU $0.128 per hour, Provisioned Memory $0.0106 per GB-hour, Invocations $0.60 per million. The estimate uses Pro on-demand prices, which is what paid traffic would run on, with 1 vCPU and 2 GB.

Assumptions for 1,000 premium calls answered from the warm cache: 50 ms active CPU and 0.3 s wall time per call, 2 GB, no instance sharing.

- CPU: 1,000 x 0.05 s = 0.0139 h x $0.128 = about $0.0018
- Memory: 1,000 x 0.3 s x 2 GB = 0.167 GB-h x $0.0106 = about $0.0018
- Invocations: about $0.0006
- Total: about $0.004 per 1,000 calls at Pro on-demand prices.

The x402 facilitator pays the settlement gas, not Compass. Price charged: 0.01 MUSD per call on Mezo mainnet (10 MUSD per 1,000), 0.001 test MUSD on testnet (1 test MUSD per 1,000), from `web/src/lib/x402.ts`.

Do-it-yourself cost: one refresh needs 34 `eth_getLogs` requests for 14 days of sMUSD yield events (Mezo RPCs cap a request at 10,000 blocks), plus pool, trove, gauge and Merkl reads; measured 7 to 37 s per cold refresh on 4 Nov 2026, depending on the RPC.
