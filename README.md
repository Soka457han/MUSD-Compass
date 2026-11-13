# MUSD Compass

Where does your MUSD earn the most after costs? Compass ranks every place Mezo MUSD can earn, on Mezo and Ethereum, by the cash you keep, with locked veMEZO 🔒 shown beside that figure and left out of it. It runs as a phone web app, a Telegram bot, a one-tag widget, a free JSON API and a pay-per-call x402 API.

Mezo Buildathon, Wave 1 · Track 1 (DeFi) and Track 2 (Access & Distribution) · no contract of its own, no custody, no keys.

| | |
|---|---|
| **Live app** | [musd-compass.vercel.app](https://musd-compass.vercel.app) (works on a phone, no wallet needed) |
| **Demo video (2 min)** | [Watch on YouTube](https://www.youtube.com/watch?v=MzgrWvwby00) |
| **Deck** | [musd-compass-deck.pdf](https://musd-compass.vercel.app/musd-compass-deck.pdf) (also [in the repo](docs/submission/musd-compass-deck.pdf)) |
| **Telegram bot** | [@musd_compass_bot](https://t.me/musd_compass_bot) |
| **API and widget** | [/developers](https://musd-compass.vercel.app/developers) |
| **Changed since Wave 1** | [FEEDBACK-RESPONSE.md](FEEDBACK-RESPONSE.md): the Wave 1 review answered point by point |
| **Proof** | [Mainnet and testnet transactions](https://musd-compass.vercel.app/proof) · [testnet table](#testnet-proof) · [all evidence](docs/evidence.md) |

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
| **Mezo Integration (30%)** | **Reads on Mezo mainnet:** sMUSD yield events (realised 14-day APR), the vault gauge's MEZO rate, Stability Pool, six Mezo MUSD pools, `PriceFeed.fetchPrice()`, BorrowerOperations and InterestRateManager for the live rate, fee and minimum, TroveManager and SortedTroves for the planner. **Writes on Mezo testnet:** sMUSD `approve`, `deposit`, `claimYield`, `withdraw`, and BorrowerOperations `openTrove`, `addColl` and `repayMUSD`. The same actions exist for Mezo mainnet but are switched off in the public deployment. **veMEZO:** Mezo's Merkl campaigns, priced at MEZO spot and kept apart from cash. **MUSD as payment:** x402 premium API at 0.001 test MUSD per call. Compass sends people into Mezo's own vault, pools and Merkl claims. |
| **Product and Business Viability (30%)** | **Who:** MUSD holders, borrowers, and BTC holders deciding whether to borrow. They get MUSD by borrowing against BTC in the Mezo app or by swapping. **Why they return:** the best venue changes every campaign week. **Business model:** free for people; apps and agents pay per premium call over x402 ([details](#business-model)). **Distribution:** bot, widget and API. |
| **Technical Implementation (20%)** | No contract that holds funds. Every write passes one guard: it checks the network and the wallet's chain, then allows only the exact functions Compass uses on each contract (an MUSD approval; vault deposit, withdraw and claim; trove open, top up and repay), with approvals only to the vault and never unlimited. Then it simulates, estimates gas × 1.2, sends and waits for the receipt. 142 unit, 40 end-to-end (axe on every page, light and dark) and 25 bot tests, all run by CI on every push. [Safety](#safety-and-threat-model). |
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
| MUSD over x402 | Pay-per-call API: 0.001 test MUSD on testnet (used so far), 0.01 MUSD on mainnet (offered once a payee is set) | testnet and mainnet |

## What is real and what is not

| Real | Not real, or not done yet |
|---|---|
| Every venue number is read live from Mezo, Ethereum or Merkl and kept for 5 minutes | **Mainnet is proven only for the Savings Vault and gauge.** Eight real mainnet transactions made through Compass's `/vault` page (5 MUSD in and out of the vault, staked and unstaked in the gauge, MEZO claimed; [proof](https://musd-compass.vercel.app/proof)). Borrow → Earn, top-up and repay have not run on mainnet, and troves in the demo flow are testnet only; testnet MUSD has no market value |
| Approve, deposit, withdraw, claim, a trove opened to borrow and deposit, and two x402 payments are real Mezo testnet transactions ([below](#testnet-proof)) | Compass has no contract of its own to audit |
| `/my`, `/vault`, `/rewards` and `/trove` samples are read from the chain | Mezo pools and the Stability Pool are listed by size; their APR lives in the Mezo app |
| The bot, widget and API return the same numbers as the web app (bot checked 26 Oct, all six buttons) | Uniswap V4 trading fees are not reported by Merkl, so they count as 0 |

## Testnet proof

Mezo testnet (chain 31611), made through [/vault](https://musd-compass.vercel.app/vault) and [/developers](https://musd-compass.vercel.app/developers), 24 to 26 Oct 2026. Every row comes from the public dev wallet [`0xfe21…676C`](https://explorer.test.mezo.org/address/0xfe21B2782B35BE770DD4a7b05f81cE43790D676C) except the second x402 payment.

| Step | Amount | Transaction |
|---|---|---|
| Approve (exact amount, not unlimited) | 100 MUSD | [`0xa5ec9c45…570f`](https://explorer.test.mezo.org/tx/0xa5ec9c450e27dfac27fb18f2ad91d2cdd5e2a1c782472108be93126766b1570f) |
| Deposit into the Savings Vault | 100 MUSD → 100 sMUSD | [`0x1f4ddeb6…8f3c`](https://explorer.test.mezo.org/tx/0x1f4ddeb61396464e32ee63806a35a3e5cf8cb9218613880e24a5324293458f3c) |
| Withdraw (also pays pending yield) | 10 MUSD | [`0x3045fba8…77cf`](https://explorer.test.mezo.org/tx/0x3045fba85e8551ca6a465567911f96b68ded7a336f99640c51b3104525f777cf) |
| Claim yield after a distribution | 0.1031 MUSD | [`0xe79ae272…7734`](https://explorer.test.mezo.org/tx/0xe79ae272024d2fe8998a1891ad07166d9a72c8093e17fdf7d6cee8007d6f7734) |
| x402 payment for `/api/premium/yields` (facilitator sent it and paid gas; Permit2 approval exactly 0.001; payer and payee are both the dev wallet) | 0.001 MUSD | [`0x0454c620…4997`](https://explorer.test.mezo.org/tx/0x0454c620d5b02fa6dd9ba0fb3f6665894498d15b825cf8730ff47a0683fa4997) |
| x402 payment from a second wallet, [`0xC20F…9C4C`](https://explorer.test.mezo.org/address/0xC20F87B85A58a0Bc1E0eE851D0bBAaDFFf9e9C4C), to the dev wallet (payer ≠ payee) | 0.001 MUSD | [`0x3a63cdf8…bc5a`](https://explorer.test.mezo.org/tx/0x3a63cdf86569c3787867fcc9ddb3ebf8c91eb8dec1a2a206c716457f8c30bc5a) |
| *Borrow → Earn* 1 of 3: `openTrove` with test BTC as collateral | 1,800 MUSD borrowed | [`0x82f0ddf6…1fe0`](https://explorer.test.mezo.org/tx/0x82f0ddf6fd1598a1a89eaf3652f69323e5fdc69151ef08209e6c5a5e8ed81fe0) |
| *Borrow → Earn* 2 of 3: approve the vault for exactly that amount | 1,800 MUSD | [`0xafbff33a…641d`](https://explorer.test.mezo.org/tx/0xafbff33ad670be5565928aaf481e6e6159d55a9d510cca06627d43ccc1fd641d) |
| *Borrow → Earn* 3 of 3: deposit the borrowed MUSD into the Savings Vault | 1,800 MUSD → 1,800 sMUSD | [`0x53da2a83…a135`](https://explorer.test.mezo.org/tx/0x53da2a8307efecc5d71eaeda40dfd172f43be82a05ef7f3c55168917c34ea135) |

The dev wallet now holds 1,890 sMUSD and 67.41 MUSD with a vault allowance of 0, and [`/api/vault/0xfe21…676C`](https://musd-compass.vercel.app/api/vault/0xfe21B2782B35BE770DD4a7b05f81cE43790D676C) shows the same. Every transaction and live check is listed in [docs/evidence.md](docs/evidence.md).

## Safety and threat model

Compass holds nothing, so the risks are a wrong transaction from your own wallet or wrong data on screen.

| Risk | Control | Test |
|---|---|---|
| Sending to the wrong contract, or the wrong call on the right one | Allowlist of contracts per network, and per contract only the functions Compass uses: MUSD `approve`; vault `deposit`, `withdraw`, `claimYield`; BorrowerOperations `openTrove`, `addColl`, `repayMUSD`. A MUSD `transfer`, closing a trove or any other call is refused before the wallet opens. | `tests/unit/sendSafely.test.ts`, *Try to break it* |
| Unlimited or misdirected approvals | Approvals go only to the vault and never near `maxUint256`; x402 uses an exact 0.001 permit. Repaying needs no approval, because BorrowerOperations burns the MUSD itself | same, plus the live panel |
| A real-funds action by accident | Mainnet writes are off unless a deploy sets `NEXT_PUBLIC_MAINNET_WRITES=1`; the guard also refuses when the wallet is on a different chain than the action; on mainnet a dialog asks for the amount to be typed first | `tests/unit/sendSafely.test.ts`, `tests/unit/borrowEarn.test.ts` |
| BTC moves between the quote and the wallet prompt | The price is read again right before the first transaction of a trove; a trove that would start under 200% is refused, and a repay that would break Mezo's 1,800 MUSD minimum debt is refused | `tests/unit/borrowEarn.test.ts`, `tests/unit/troveActions.test.ts` |
| Phone wallets (WalletConnect) | Loaded only when someone taps it; the connection is checked again for the same account before every action; CSP allows only its relay, verify and wallet-list hosts | `tests/unit/walletconnect.test.ts`, `e2e/security.spec.ts` |
| A transaction that would fail | Simulated first, gas estimate × 1.2, receipt awaited | `tests/unit/sendSafely.test.ts` |
| Clickjacking and injection | `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` (except `/embed`), CSP, `nosniff`, strict referrer | `e2e/security.spec.ts` |
| Bad third-party data (Merkl, RPCs) | Only `https:` links survive, numbers are validated, a source that is down reads "unavailable" instead of showing an old figure, and `/api/health` hides upstream errors | `tests/unit/merkl.test.ts`, `tests/unit/health.test.ts` |
| API abuse | Every input validated at the route, addresses URL-encoded on the client, rate limits | unit and e2e |
| Bot abuse | Timing-safe key check, Telegram secret check, 1 MB cap, malformed updates ignored | `bot/tests/` |

Accepted for now: a zod 3 advisory inside `@x402` (GHSA-mrhx-c7xc-m3w5; the server refuses payment headers over 16 KB before parsing) and, since Wave 2, the same advisory inside the WalletConnect library, which runs only in the visitor's own browser tab; hints and prices come from public RPCs, so a hostile RPC could skew a displayed ratio, but Mezo's contracts still enforce their own limits when the transaction runs; rate limits are per serverless instance; the CSP allows inline scripts because Next's App Router needs them, which also means the hosts it allows for WalletConnect are reachable from any injected script. `pip-audit` on the bot finds nothing.

### Security review findings (25 Oct 2026)

Threat model by trust boundary (browsers, the public API, the Telegram webhook, third-party data from Merkl and RPCs, wallets), then a fix and a test for each finding. Added 26 Oct: the guard refuses unlimited approvals and approvals to anyone but the vault on its own, BorrowerOperations is allowed for `openTrove` only, and client lookups URL-encode the address.

| # | Finding | Fix | Test |
|---|---|---|---|
| 1 | Pages with wallet actions could be framed by another site (clickjacking) | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` everywhere except `/embed`, which is meant to be framed | `e2e/security.spec.ts` |
| 2 | No CSP, `nosniff`, referrer or permissions policy | CSP (`default-src 'self'`, `connect-src 'self' https://rpc.test.mezo.org`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`), `nosniff`, `strict-origin-when-cross-origin`, camera/mic/geolocation/payment off | `e2e/security.spec.ts` (headers + no CSP violations) |
| 3 | Links from Merkl's API were rendered as they came | Only `https:` links survive; anything else points to Merkl's own app | `tests/unit/merkl.test.ts` |
| 4 | `/api/health` returned raw upstream errors (can contain a keyed RPC URL) and had no rate limit | Says `unreachable`, details go to server logs; rate-limited | `tests/unit/health.test.ts` |
| 5 | Bot key compared with `===` | `timingSafeEqual` | `tests/unit/rateLimit.test.ts` |
| 6 | Bot webhook crashed on valid JSON that isn't an update object (`[]`, `null`) | Shape checked; anything else is ignored with 200 | `bot/tests/test_webhook.py` |
| 7 | CI typecheck failed on every run (route types not generated before `tsc`) | `next typegen && tsc --noEmit` | full CI pipeline re-run in a clean clone |
| 8 | Home page also downloaded the `/developers` wallet code (nav prefetch): 13 scripts / 290 KB | Nav links don't prefetch; CSS inlined | Lighthouse ×3 above (7 scripts / 148 KB) |

Already in place and re-checked: every API input validated at the route (amount, mode, days, rate, addresses); the webhook checks Telegram's secret with `hmac.compare_digest` and caps the body at 1 MB; the vault only sends to testnet MUSD and sMUSD, simulates first and approves the exact amount; the x402 button checks the asset, network, payee and amount before signing; no secrets in the repo or its history; no raw-HTML sinks.

## Business model

Free for people. Apps and agents pay per call to the premium endpoint (every mode × holding period, plus planner and rewards for an address) over x402, in MUSD: 0.001 test MUSD on Mezo testnet, and 0.01 MUSD on Mezo mainnet. The facilitator lists MUSD on both networks, so the mainnet price is a real x402 requirement, not a plan. The 402 response offers it once the deploy sets `X402_MAINNET_PAY_TO` to the wallet that should receive the MUSD; without that setting only the testnet price is offered, and a malformed address is never advertised. Two paid calls are on-chain, both on testnet, one of them from a second wallet (see proof). No paid call has been made on mainnet.

Who pays and why: anyone who needs this answer for many amounts or many addresses from one server, or an agent that cannot sign up for an API key and just pays per call. Concretely, a wallet or app that shows where to put MUSD, an agent that rebalances between holding and borrowing and keeps a trove above 200%, and an alert bot that looks up a user's rewards and trove ratio. The paid call replaces eight free requests (six combinations of mode and holding period, plus rewards and trove). The free API allows 60 requests a minute per IP, so one server fits about 7 full lookups a minute free and 60 with the paid call. Reading the chain without Compass is heavier: 14 days of sMUSD yield events take 34 `eth_getLogs` requests on Mezo mainnet, because its RPCs cap a request at 10,000 blocks. Both payments on record are ours, so there are no outside buyers yet. The price is a starting point and will be reviewed once real buyers exist.

## Verification (26 Oct 2026)

Each number was compared with its primary source, the chain or Merkl, as well as with our own API.

- `/api/health`: Mezo mainnet and fallback RPC, Mezo testnet, Ethereum and Merkl all OK, each in 100 to 200 ms.
- Savings Vault APR recomputed from raw mainnet events: 9 yield events, 11,349 MUSD over 14 days ÷ 7.38M sMUSD = 4.008%; the API shows 4.008%.
- Vault gauge: `rewardRate` × a year × MEZO price ÷ staked sMUSD gives 1.39%; the Mezo app showed 1.38%.
- Borrow parameters equal the chain: 1% rate, 0.1% fee, 1,800 minimum debt, 200 gas compensation.
- All 12 pages and 9 API routes answer as expected; `/api/premium/yields` unpaid returns 402 for exactly 0.001 test MUSD.
- Telegram: all six buttons, `/yield`, a bad address and a bad amount give the right answers.
- Mainnet dry run, simulated and not executed: Borrow → Earn for 2,000 MUSD builds, passes the guard and simulates on Mezo mainnet with real hints; details and the command in [docs/evidence.md](docs/evidence.md#mezo-mainnet-dry-run-simulated-not-executed-3-nov-2026).
- Tests: 142 unit, 40 end-to-end, 25 bot, all run by CI on every push. Lighthouse mobile: 0.92 to 0.98 performance, 1.0 accessibility and best practices.

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
- A first paid mainnet call from a buyer other than us, and a review of the 0.01 MUSD price once there are real buyers.
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

Telegram commands: `/yield [amount]`, `/carry <amount> [borrow]`, `/vault <address>`, `/rewards <address>`, `/trove <address|sample>`, `/help`, plus six buttons.

Tech stack: Next.js 16 (App Router, React 19) on Vercel · TypeScript · viem · Tailwind CSS 4 · x402 (`@x402/next`, `@x402/evm`, `@x402/fetch`) · Python 3.13 Telegram webhook · Merkl API · Vitest, Playwright, axe-core, pytest · GitHub Actions CI.

Spec: [SPEC.md](SPEC.md) · design: [docs/design.md](docs/design.md) · plan: [tasks/plan.md](tasks/plan.md) · changelog: [CHANGELOG.md](CHANGELOG.md) · MIT licence.
