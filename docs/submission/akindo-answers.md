# AKINDO submission — draft answers (Wave 1)

> Draft for you to read and edit. The exact AKINDO form fields weren't recorded, so these follow the usual WaveHack fields; copy each block into the matching box. Every claim below is something that shipped and can be tested on the live site. Update the two `TODO` lines before you submit.

## Project name
MUSD Compass

## One-line tagline
Where your MUSD earns the most after costs — ranked by cash, on your phone, in Telegram, or on any website.

## Tracks
- **Track 1 — DeFi**: a net-carry calculator for holding or borrowing MUSD, plus Savings Vault deposit, claim and withdraw on Mezo testnet.
- **Track 2 — Access & Distribution**: the same numbers on phones (the Mezo app is desktop-only), in a Telegram bot, in a one-tag website widget, and through a free JSON API.

## Problem
MUSD holders can put MUSD in the Savings Vault, six Mezo pools, the Stability Pool, or Mezo-paid pools on Ethereum. Each place shows a different number. Some pay in cash, some pay in veMEZO that is locked for 12 weeks, and the Ethereum ones cost a bridge round trip. No screen answers the simple question: *after costs, where does my MUSD earn the most cash?* On a phone there is no Mezo app at all, and unclaimed veMEZO rewards can be reallocated if nobody claims them.

## Solution
MUSD Compass reads Mezo mainnet, Ethereum and Merkl live and ranks every MUSD venue by **net carry**:
- **Cash first.** The big number is what you can spend: liquid yield minus costs, spread over your holding period (30 / 90 / 365 days, default 90).
- **Locked beside it, never inside it.** veMEZO rewards (12-week lock, valued at MEZO spot) are shown next to the cash number as 🔒 total carry.
- **Every number states its assumption** ("assumes 90-day hold") and its source. A source that is down shows as unavailable instead of a guess.
- **Holder or borrower.** Borrower mode adds the real trove costs: 0.1% fee, interest on the whole debt including the 200 MUSD gas compensation, and the 1,800 MUSD minimum.
- **Break-even.** For Ethereum venues it shows the amount range where they beat the Savings Vault, for cash and for total.
- **Act on testnet.** On `/vault` you connect any EVM wallet and deposit into the real Savings Vault contracts on Mezo testnet (exact approval, then deposit), claim yield and withdraw.
- **Don't lose rewards.** `/rewards` shows any address's unclaimed veMEZO from Mezo's Merkl campaigns, with the reallocation warning and how to claim.
- **Plan your trove.** `/trove` reads a mainnet trove's collateral ratio, its own interest rate and its place in the redemption queue, shows how much more it can borrow while staying at or above 200%, and hands that rate to the calculator. (Mezo mainnet has one open trove today, so the sample is that trove.)

## How it uses Mezo
- **Reads on Mezo mainnet:** sMUSD yield events and supply (a realised 14-day APR from `ProtocolYieldReceived` + `StrategyYieldReceived`), Stability Pool deposits, six Mezo MUSD pools, BTC price from `PriceFeed.fetchPrice()`, and live borrow parameters (BorrowerOperations, InterestRateManager), and for the planner TroveManager and SortedTroves.
- **Writes on Mezo testnet:** sMUSD `approve` (exact amount) → `deposit`, `claimYield`, `withdraw`. Proof transactions are in the README.
- **MUSD as payment:** a premium API paid with 0.001 test MUSD over x402 (Permit2 with an exact-amount permit; the facilitator pays gas), with a *Pay & fetch* button anyone can try.
- **Mezo incentives:** Merkl campaigns that pay veMEZO on Ethereum MUSD pools, and per-user unclaimed veMEZO.
- **Routes to Mezo's own products** instead of rebuilding them: the Savings Vault, the Mezo app pools pages, Merkl claim.

## How it's built
- **Web and API:** Next.js 16 (App Router, Cache Components) on Vercel; viem for chain reads and writes; one adapter per source, cached 5 minutes and shared across instances; JSON-RPC batching to stay inside the RPC's rate limit.
- **Bot:** a thin Python Telegram webhook on Vercel that only calls the public API. It needs no bot token at runtime and stores nothing.
- **Safety:**
  - Compass sends transactions only to testnet MUSD and sMUSD (an allowlist in code).
  - Every write is simulated before signing and sent with gas = estimate × 1.2.
  - Approvals are for the exact amount, never unlimited.
  - No custody, no own contracts, no keys asked for, no mainnet writes.
- **Quality:**
  - 63 unit tests (carry math, break-even, sources, safety rules, trove math, the x402 pre-sign guard), 20 end-to-end tests at 360 px and 16 bot tests.
  - axe accessibility checks on every page in light and dark.
  - CI on GitHub Actions; Lighthouse mobile accessibility 100.

## Try it (no wallet needed)
- Live app: https://musd-compass.vercel.app
- 60-second judge path: in the README.
- Telegram: https://t.me/musd_compass_bot — `/yield`, `/carry 2000 borrow`, `/vault 0xfe21B2782B35BE770DD4a7b05f81cE43790D676C`, `/rewards 0xeaC6A75e19beB1283352d24c0311De865a867DAB`, `/trove sample`
- API and widget: https://musd-compass.vercel.app/developers
- Get test MUSD: https://musd-compass.vercel.app/get-test-musd
- GitHub: TODO — paste your repository link
- Video: TODO — paste the video link after recording

## What's next (Wave 2)
- Phone wallets through WalletConnect, so deposits work outside a wallet's own browser.
- Bot alerts when a venue overtakes the one you are in, or when your veMEZO rewards are waiting to be claimed.
- Mainnet Savings Vault deposits once the testnet flow has been reviewed.

## Honest limits
- Mezo pool APRs and the Stability Pool are listed by size only; their APR lives in the Mezo app, and the Stability Pool earns only on liquidations.
- veMEZO is valued at MEZO spot; the 12-week lock means you can't sell it at that price today.
- Uniswap V4 trading fees are not reported by Merkl, so they count as 0.
- Testnet distributions come weekly, so a fresh deposit shows 0 pending yield until the next one.
