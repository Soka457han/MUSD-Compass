# MUSD Compass

Where does your MUSD earn the most after costs? Compass ranks every place Mezo MUSD can earn, on Mezo and Ethereum, by the cash you keep, with locked veMEZO 🔒 shown beside that figure and left out of it. It runs as a phone web app, a Telegram bot, a one-tag widget, a free JSON API and a pay-per-call x402 API.

Mezo Buildathon, Wave 1 · Track 1 (DeFi) and Track 2 (Access & Distribution) · no contract of its own, no custody, no keys.

| | |
|---|---|
| **Live app** | [musd-compass.vercel.app](https://musd-compass.vercel.app) (works on a phone, no wallet needed) |
| **Demo video (2 min)** | [add the video link] |
| **Deck** | [add the deck PDF link] |
| **Telegram bot** | [@musd_compass_bot](https://t.me/musd_compass_bot) |
| **API and widget** | [/developers](https://musd-compass.vercel.app/developers) |
| **Proof** | [Testnet transactions](#testnet-proof) · [all evidence](docs/evidence.md) |

## Judge fast path (60 seconds, no wallet)

1. Open the [app](https://musd-compass.vercel.app). The top card is where 2,000 MUSD earns the most cash a year after costs. Each venue card says what your amount keeps before you go in; *Why this number* shows the source.
2. Change the amount, or switch to *Borrow* or *365 days*. The list re-ranks and every number says what it assumes. Ethereum pools show the amount where they start to beat the Savings Vault.
3. Press *Have BTC? See if borrowing MUSD pays*. Compass switches to a new trove and says in one line whether borrowing MUSD against BTC and putting it in the vault pays after the fee and interest.
4. [/my](https://musd-compass.vercel.app/my) → *Try a sample*: a real address's idle MUSD, Savings Vault and gauge-staked sMUSD, each next to the best cash place for that amount, plus every place the total could go.
5. [/vault](https://musd-compass.vercel.app/vault) → *Try to break it*: ask for an unlimited approval, send to an unknown contract, deposit 1,000,000 MUSD. All three are refused for real, with no wallet. *Try a sample* shows the dev wallet's position on Mezo testnet.
6. [/rewards](https://musd-compass.vercel.app/rewards) and [/trove](https://musd-compass.vercel.app/trove) → *Try a sample*: unclaimed veMEZO for a real address, and a live mainnet trove's ratio, rate and redemption-queue position.
7. Telegram: [@musd_compass_bot](https://t.me/musd_compass_bot). Tap a button; if it needs an amount or an address, it asks.

To deposit yourself (about 2 minutes with a wallet): [get test MUSD in 3 steps](https://musd-compass.vercel.app/get-test-musd), open `/vault` in a wallet's browser, press *Connect wallet* and deposit. Compass approves the exact amount and simulates every transaction before you sign.

## The problem

MUSD can earn in the Savings Vault, the Stability Pool, six Mezo pools and Mezo-paid pools on Ethereum. Each shows a different number, and the biggest numbers mislead.

veMEZO rewards stay locked for 12 weeks, so a large APR can be mostly lock and very little cash. Costs eat small deposits: an Ethereum pool needs a bridge round trip and gas both ways, and borrowed MUSD carries trove interest, a 0.1% fee and a 1,800 MUSD minimum. The best place also moves. Overnight from 24 to 25 Oct 2026 the Uniswap V4 veMEZO APR went from 49.8% to 79.9% while MEZO rose 60%.

On a phone, Mezo's own app asks for a larger window (checked 26 Oct). No screen answered "after costs, where do I keep the most cash?"

## Who it is for, and why they come back

- MUSD holders want to know where MUSD earns most after costs, and whether what they already hold could earn more. *My MUSD* shows, for example, that sMUSD staked in the vault gauge earns about 1.34% in MEZO while the unstaked vault pays 4.01%.
- BTC holders want to know whether borrowing MUSD is worth it at all. A yes means more MUSD gets minted.
- Builders and agents get the same numbers through a free API, a widget and a premium call paid in MUSD.

People come back because Mezo's reward campaigns renew every 7 days and rates jump, so the best place for the same MUSD changes from week to week.

## What Compass does

| Feature | What you get |
|---|---|
| **Net-carry ranking** | 11 venues ranked by cash after costs, hold or borrow, 30 / 90 / 365 days. Every number states its assumption and source, and a source that is down reads "unavailable". |
| **Before you go in** | For your amount and hold: the MUSD you keep, the one-off costs, and the day they are earned back. |
| **Have BTC?** | The spread between the live borrow rate and the vault, after the fee and interest, in one line. |
| **My MUSD** | Any address's wallet, Savings Vault (staked or not), Stability Pool, trove and unclaimed veMEZO, each against the best place for that amount. |
| **Break-even** | The amount range where an Ethereum pool beats the Savings Vault. |
| **Testnet vault** | Deposit, claim and withdraw on the real Savings Vault contracts, plus *Borrow → Earn*: open a testnet trove at 200% and deposit the MUSD. |
| **Try to break it** | Three attacks run live with no wallet, and Compass or the chain refuses each one. |
| **Rewards check** | Unclaimed veMEZO for any address from Mezo's Merkl campaigns, with the reallocation warning. |
| **Trove planner** | A mainnet trove's ratio, its own rate, redemption-queue position, and how much more it can borrow at 200% or above. |
| **Everywhere** | Phone web app (light and dark) · Telegram bot with six buttons · one-tag widget · free JSON API · paid x402 API. |

## Judging criteria, mapped to evidence

| Criterion (weight) | Evidence |
|---|---|
| **Mezo Integration (30%)** | **Reads on Mezo mainnet:** sMUSD yield events (realised 14-day APR), the vault gauge's MEZO rate, Stability Pool, six Mezo MUSD pools, `PriceFeed.fetchPrice()`, BorrowerOperations and InterestRateManager for the live rate, fee and minimum, TroveManager and SortedTroves for the planner. **Writes on Mezo testnet:** sMUSD `approve`, `deposit`, `claimYield`, `withdraw`, and BorrowerOperations `openTrove`. **veMEZO:** Mezo's Merkl campaigns, priced at MEZO spot and kept apart from cash. **MUSD as payment:** x402 premium API at 0.001 test MUSD per call. Compass sends people into Mezo's own vault, pools and Merkl claims. |
| **Product and Business Viability (30%)** | **Who:** MUSD holders, borrowers, and BTC holders deciding whether to borrow. They get MUSD by borrowing against BTC in the Mezo app or by swapping. **Why they return:** the best venue changes every campaign week. **Business model:** free for people; apps and agents pay per premium call over x402 ([details](#business-model)). **Distribution:** bot, widget and API. |
| **Technical Implementation (20%)** | No contract that holds funds. Every write passes one guard (allowlist, approvals only to the vault and never unlimited, BorrowerOperations only for `openTrove`), then simulate, gas estimate × 1.2, send, wait for the receipt. 88 unit, 39 end-to-end (axe on every page, light and dark) and 25 bot tests; CI green on the latest run (#28). [Safety](#safety-and-threat-model). |
| **User Experience (10%)** | Phone first, light and dark, WCAG AA checks in the end-to-end suite, *Try a sample* on every address feature, a skeleton while live rates load. Lighthouse mobile: 0.92 to 0.98 performance, 1.0 accessibility. |
| **Submission Materials (10%)** | This README, [SPEC.md](SPEC.md), [design](docs/design.md), [evidence](docs/evidence.md), deck, 2-minute video. Every claim links to a transaction, a contract or a test. |

## Built on Mezo

| Mezo product | What Compass does | Chain |
|---|---|---|
| MUSD Savings Vault (sMUSD) | Reads yield events and supply; deposit, claim, withdraw | mainnet read · testnet write |
| Vault gauge | Reads the MEZO paid to staked sMUSD (`rewardRate`, staked supply) | mainnet |
| Stability Pool | Reads its size and an address's deposit | mainnet |
| Mezo DEX pools (6) | Reads reserves and size | mainnet |
| PriceFeed, BorrowerOperations, InterestRateManager | Live BTC price, borrow rate, fee and minimum debt; opens a trove | mainnet read · testnet write |
| TroveManager, SortedTroves | Trove planner and redemption-queue position | mainnet |
| veMEZO (via Merkl) | Campaign APRs and per-address unclaimed rewards | mainnet |
| MUSD over x402 | Pay-per-call API | testnet |

## What is real and what is not

| Real | Not real, or not done yet |
|---|---|
| Every venue number is read live from Mezo, Ethereum or Merkl and kept for 5 minutes | **No mainnet writes.** Deposits and troves are testnet only; testnet MUSD has no market value |
| Approve, deposit, withdraw, claim and the x402 payment are real Mezo testnet transactions ([below](#testnet-proof)) | Compass has no contract of its own to audit |
| `/my`, `/vault`, `/rewards` and `/trove` samples are read from the chain | Mezo pools and the Stability Pool are listed by size; their APR lives in the Mezo app |
| The bot, widget and API return the same numbers as the web app (bot checked 26 Oct, all six buttons) | Uniswap V4 trading fees are not reported by Merkl, so they count as 0 |
| | Two proof rows are still open: a *Borrow → Earn* trove and an x402 call from a second wallet (payer ≠ payee) |

## Testnet proof

Mezo testnet (chain 31611), made through [/vault](https://musd-compass.vercel.app/vault) from the public dev wallet [`0xfe21…676C`](https://explorer.test.mezo.org/address/0xfe21B2782B35BE770DD4a7b05f81cE43790D676C), 24 to 26 Oct 2026:

| Step | Amount | Transaction |
|---|---|---|
| Approve (exact amount, not unlimited) | 100 MUSD | [`0xa5ec9c45…570f`](https://explorer.test.mezo.org/tx/0xa5ec9c450e27dfac27fb18f2ad91d2cdd5e2a1c782472108be93126766b1570f) |
| Deposit into the Savings Vault | 100 MUSD → 100 sMUSD | [`0x1f4ddeb6…8f3c`](https://explorer.test.mezo.org/tx/0x1f4ddeb61396464e32ee63806a35a3e5cf8cb9218613880e24a5324293458f3c) |
| Withdraw (also pays pending yield) | 10 MUSD | [`0x3045fba8…77cf`](https://explorer.test.mezo.org/tx/0x3045fba85e8551ca6a465567911f96b68ded7a336f99640c51b3104525f777cf) |
| Claim yield after a distribution | 0.1031 MUSD | [`0xe79ae272…7734`](https://explorer.test.mezo.org/tx/0xe79ae272024d2fe8998a1891ad07166d9a72c8093e17fdf7d6cee8007d6f7734) |
| x402 payment for `/api/premium/yields` (facilitator sent it and paid gas; Permit2 approval exactly 0.001; payer and payee are both the dev wallet) | 0.001 MUSD | [`0x0454c620…4997`](https://explorer.test.mezo.org/tx/0x0454c620d5b02fa6dd9ba0fb3f6665894498d15b825cf8730ff47a0683fa4997) |

The wallet now holds 90 sMUSD and 67.41 MUSD with a vault allowance of 0, and [`/api/vault/0xfe21…676C`](https://musd-compass.vercel.app/api/vault/0xfe21B2782B35BE770DD4a7b05f81cE43790D676C) shows the same. Every transaction and live check is listed in [docs/evidence.md](docs/evidence.md).

## Safety and threat model

Compass holds nothing, so the risks are a wrong transaction from your own wallet or wrong data on screen.

| Risk | Control | Test |
|---|---|---|
| Sending to the wrong contract | Allowlist: testnet MUSD, sMUSD, and BorrowerOperations for `openTrove` only. Anything else is refused before the wallet opens. | `tests/unit/sendSafely.test.ts`, *Try to break it* |
| Unlimited or misdirected approvals | Approvals go only to the vault and never near `maxUint256`; x402 uses an exact 0.001 permit | same, plus the live panel |
| A transaction that would fail | Simulated first, gas estimate × 1.2, receipt awaited | `tests/unit/sendSafely.test.ts` |
| Clickjacking and injection | `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` (except `/embed`), CSP, `nosniff`, strict referrer | `e2e/security.spec.ts` |
| Bad third-party data (Merkl, RPCs) | Only `https:` links survive, numbers are validated, a source that is down reads "unavailable" instead of showing an old figure, and `/api/health` hides upstream errors | `tests/unit/merkl.test.ts`, `tests/unit/health.test.ts` |
| API abuse | Every input validated at the route, addresses URL-encoded on the client, rate limits | unit and e2e |
| Bot abuse | Timing-safe key check, Telegram secret check, 1 MB cap, malformed updates ignored | `bot/tests/` |

Accepted for Wave 1: a zod 3 advisory inside `@x402` (GHSA-mrhx-c7xc-m3w5; the server refuses payment headers over 16 KB before parsing); rate limits are per serverless instance; the CSP allows inline scripts because Next's App Router needs them. `pip-audit` on the bot finds nothing.

## Business model

Free for people. Apps and agents pay 0.001 test MUSD per call to the premium endpoint (every mode × holding period, plus planner and rewards for an address) over x402, and a real paid call is on-chain (see proof). Mainnet pricing is not set yet; it needs a mainnet x402 deployment.

## Verification (26 Oct 2026)

Each number was compared with its primary source, the chain or Merkl, as well as with our own API.

- `/api/health`: Mezo mainnet and fallback RPC, Mezo testnet, Ethereum and Merkl all OK, each in 100 to 200 ms.
- Savings Vault APR recomputed from raw mainnet events: 9 yield events, 11,349 MUSD over 14 days ÷ 7.38M sMUSD = 4.008%; the API shows 4.008%.
- Vault gauge: `rewardRate` × a year × MEZO price ÷ staked sMUSD gives 1.39%; the Mezo app showed 1.38%.
- Borrow parameters equal the chain: 1% rate, 0.1% fee, 1,800 minimum debt, 200 gas compensation.
- All 12 pages and 9 API routes answer as expected; `/api/premium/yields` unpaid returns 402 for exactly 0.001 test MUSD.
- Telegram: all six buttons, `/yield`, a bad address and a bad amount give the right answers.
- Tests: 88 unit, 39 end-to-end, 25 bot; CI green (#28). Lighthouse mobile: 0.92 to 0.98 performance, 1.0 accessibility and best practices.

## Limits

- The Savings Vault yield is variable and realised over 14 days; it is not a promise.
- veMEZO is valued at MEZO spot, but the 12-week lock means you cannot sell it at that price today.
- Testnet distributions come weekly, so a fresh deposit shows 0 pending yield until the next one.
- Mainnet has one open trove today, so the trove sample shows 0 of 1 in the queue.
- Depositing needs a wallet's browser (MetaMask, Rabby, a wallet app) until WalletConnect lands.
- After a quiet spell the bot's first answer can take about 20 seconds while the server starts.

## Roadmap

### Wave 2

- Savings Vault deposits on mainnet with a hard cap per deposit and a capped launch, after a review. It is the biggest integration step, and it waits because it needs funds and carries mainnet risk.
- Per-user `/watch` alerts in the bot, such as "your veMEZO is waiting to be claimed". This needs a small database.
- Mezo Passport for Bitcoin-wallet users, shipped together with WalletConnect for any phone wallet.
- x402 on mainnet MUSD, with real pricing set at the same time.
- A shared rate-limit store, and a review of the zod advisory once x402 moves to zod 4 (by 26 Nov 2026).
- Mezo pool APRs read on chain, so the pools join the ranking.

### After Wave 2

Routes into Mezo pools and veMEZO, the API inside other Mezo apps, and the bot on WhatsApp.

## Run locally

```
cd web && npm ci && npm run dev        # http://localhost:3000
cd bot && python -m pip install -r requirements.txt && python -m pytest -q
```

Bot without the webhook (needs your own bot token; delete the webhook first):

```
cd bot && TELEGRAM_BOT_TOKEN=... COMPASS_API_URL=http://localhost:3000 python compass_bot.py --poll
```

Spec: [SPEC.md](SPEC.md) · design: [docs/design.md](docs/design.md) · plan: [tasks/plan.md](tasks/plan.md) · changelog: [CHANGELOG.md](CHANGELOG.md) · MIT licence.
