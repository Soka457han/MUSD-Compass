# AKINDO submission — answers (Wave 1)

> Field by field, in the order of the official form (app.akindo.io/wave-hacks/OVOO0gdrVU8379D10, read 25 Oct). Copy each block into its box. Two `TODO`s remain: your X link and the video link.
>
> Also required for Stage 1 screening (or the submission is not forwarded): live link, public GitHub repo, project deck, 2-minute pitch video.

## Project name
MUSD Compass

## Project category (3–5 words)
Yield discovery and aggregation

## TL;DR (one sentence)
MUSD Compass ranks every place Mezo's MUSD can earn by cash you keep after costs — on your phone, in Telegram, in any website and through an API — and lets you deposit into Mezo's Savings Vault in a few taps.

## How it works
**The problem.** MUSD can earn in Mezo's Savings Vault, six Mezo pools, the Stability Pool, and Mezo-paid pools on Ethereum. Each shows a different number. Some pay cash; some pay veMEZO that is locked for 12 weeks; the Ethereum ones cost a bridge round trip; borrowers also pay a fee and interest on the whole debt. Nobody shows the one number that matters — what you keep. And on a phone the Mezo app asks for a larger window (checked 26 Oct). Unclaimed veMEZO can even be reallocated if nobody claims it.

**How it functions.** Compass reads Mezo mainnet, Ethereum and Merkl live and ranks every MUSD venue by **net carry**:
- **Cash first:** liquid yield minus costs, spread over your holding period (30 / 90 / 365 days). Locked veMEZO is shown beside it as a 🔒 total, never mixed into cash.
- **Holder or borrower:** borrower mode adds real trove costs (0.1% fee, interest on the whole debt incl. the 200 MUSD gas compensation, the 1,800 MUSD minimum).
- **Break-even:** for Ethereum pools, the amount range where they beat the Savings Vault.
- **Act:** connect a wallet and deposit into the real Savings Vault contracts on Mezo testnet (exact-amount approval, simulated before you sign), claim and withdraw.
- **My MUSD:** paste any address to see its idle MUSD, Savings Vault, Stability Pool, trove and unclaimed veMEZO on Mezo mainnet, each next to the best cash place for that amount and how much more a year it would earn there.
- **Before you go in:** every venue says what your amount keeps over your hold in MUSD, what you pay up front (bridge, gas, borrow fee) and after how many days that is earned back.
- **Have BTC?:** one tap switches to borrowing and says in one line whether minting MUSD against BTC to put it to work pays after the fee and interest (25 Oct: Savings Vault 4.01% against a 1% borrow rate, about 2.5% a year kept on 2,000 MUSD).
- **Don't lose rewards:** check any address for unclaimed veMEZO; plan an existing trove (ratio, rate, redemption-queue position, safe extra borrow).
- **Everywhere:** phone web app, Telegram bot (six buttons, or `/yield`, `/carry`, `/vault`, `/rewards`, `/trove`), a one-tag website widget, a free JSON API, and a premium API paid in MUSD over x402.

**How MUSD and MEZO are used and positioned.**
- MUSD is the asset every ranking is about; Compass sends holders into Mezo's own products — the Savings Vault, Mezo pools, Merkl claims — instead of rebuilding them ("extend, don't detour").
- MUSD is also the payment: agents and apps pay 0.001 MUSD per premium API call via x402 (Permit2 with an exact-amount permit; the facilitator pays gas). A real paid call is on-chain.
- MEZO/veMEZO: Mezo's vote-escrowed incentives are priced at MEZO spot and shown beside cash; Compass reminds users to claim them and measures what each campaign spends per $1k of liquidity (for the Mezo team).
- Composability: Compass reads Mezo's DEX pools, the Stability Pool, borrowing contracts and the veMEZO incentive layer, and is itself a building block — open API, embeddable widget, pay-per-call API for agents.

**Why it matters even when one venue leads.** The answer changes: overnight on 24→25 Oct the Uniswap V4 veMEZO APR went from 49.8% to 79.9% and MEZO rose 60%. Today the Savings Vault (4.01%) wins on cash, but for a holder who accepts the 12-week lock the Ethereum pools win on total (up to 75.6% for 2,000 MUSD) — and borrowers get a different answer again. Campaigns renew weekly, so the ranking is worth checking every week, and My MUSD shows what that change means for your own address; Wave 2 adds alerts so users don't have to look.

**Business model.** Free for people. Agents and apps that want everything in one call — every mode × holding period, plus an address's trove and rewards — pay 0.001 MUSD per call over x402. Distribution: the Telegram bot, the widget inside other sites, and the API inside other apps.

**Proof (Mezo testnet):** exact approve 100 MUSD, deposit 100, withdraw 10, and one x402 payment — explorer links in the README.

## Target group
- **Who:** MUSD holders and borrowers on Mezo, and BTC holders deciding whether to borrow MUSD at all — retail and DeFi users from beginner to intermediate who want one clear answer: "where does my MUSD earn most after costs?" Secondary: developers and AI agents who want the same numbers by API.
- **Where and how:** global, phone-first (most crypto users are on phones), plus Telegram for users who live in chat.
- **Track fit:** Track 2 (Access and Distribution) — a discovery platform and aggregator for Mezo earning products, with a Telegram bot for monitoring; and Track 1 (DeFi yield) — a net-carry calculator for holding vs borrowing MUSD and Savings Vault deposits.

## Tech stack
Next.js 16 (App Router, React 19) on Vercel · TypeScript · viem · Tailwind CSS 4 · x402 (`@x402/next`, `@x402/evm`, `@x402/fetch`) · Python 3.13 Telegram webhook · Merkl API · Vitest, Playwright, axe-core, pytest · GitHub Actions CI

## Track
Both — Track 1 (DeFi) and Track 2 (Access and Distribution)

## Chain deployed on
Mezo — reads Mezo mainnet (and Ethereum for Mezo-paid pools); wallet actions and x402 payments on Mezo testnet

## Project status
Entirely new, built during the hackathon

## Project readiness
Testnet deployment (live app with mainnet data; deposits and payments on Mezo testnet)

**Known limit, said plainly:** on a phone, deposits work inside a wallet app's browser (MetaMask, Rabby…). Plain Chrome/Safari on a phone can read everything but can't sign yet — WalletConnect is milestone 2.

## Future milestones
1. **WhatsApp bot + alerts — Wave 2, by 15 Nov 2026.** The Telegram commands on WhatsApp, and alerts when a better venue appears or veMEZO is waiting to be claimed.
2. **WalletConnect phone wallets — Wave 2, by 15 Nov 2026.** Deposit, claim and withdraw from any phone browser.
3. **Mainnet + deeper composability — December 2026 to January 2027.** Savings Vault deposits on Mezo mainnet after review, one-click routes into Mezo pools and veMEZO, and the API offered to other Mezo apps.

## Team info
Solo builder — product, design, web app, on-chain integration, Telegram bot. X: TODO — paste your X profile link

## Links
- Live app: https://musd-compass.vercel.app
- GitHub: https://github.com/Soka457han/MUSD-Compass
- Telegram bot: https://t.me/musd_compass_bot
- API and widget: https://musd-compass.vercel.app/developers
- Deck: (the PDF you download from the deck)
- 2-minute video: TODO — paste after recording
