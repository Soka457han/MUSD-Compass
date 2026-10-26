# MUSD Compass

Where does Mezo MUSD earn the most **after costs**? MUSD Compass ranks every venue — Mezo and Ethereum — by net carry (cash first, locked veMEZO 🔒 beside it) and lets you deposit into the Mezo Savings Vault on testnet in a few taps. Phone-first web app, open API, embeddable widget, Telegram bot.

**Who it is for, and why they come back**
- **MUSD holders:** where MUSD earns most after costs, and *My MUSD* shows whether what an address already holds could earn more elsewhere.
- **BTC holders:** *Have BTC?* says whether borrowing MUSD against BTC to put it to work pays after the fee and interest. That is the case for minting MUSD.
- **Builders and agents:** free JSON API, a one-tag widget, and a premium call paid in MUSD over x402.
- **Why again next week:** Mezo's reward campaigns renew every 7 days and rates jump (Uniswap V4 veMEZO APR 49.8% → 79.9% overnight, 24–25 Oct), so the best place for the same MUSD moves.

Compass holds no funds and deploys no contract: every transaction goes from the user's wallet straight to Mezo's own contracts.

## Judge check in 60 seconds
Everything works on a phone, without a wallet.

1. **Ranking** — open [musd-compass.vercel.app](https://musd-compass.vercel.app). The top label is where 2,000 MUSD earns the most **cash** per year after costs; locked veMEZO 🔒 sits beside it and never counts as cash.
2. **Calculator** — change the amount, switch to *Borrower* or *365 days*: labels re-rank and every number states its assumption. Ethereum venues show the amount where they beat the Savings Vault.
3. **Testnet vault** — [`/vault`](https://musd-compass.vercel.app/vault) → *Try a sample* shows the dev wallet's real position (90 sMUSD). To deposit yourself: [get test MUSD in 3 steps](https://musd-compass.vercel.app/get-test-musd), then *Connect wallet*. On a phone, open the link inside your wallet app's browser (MetaMask, Rabby…); plain Chrome/Safari can read everything but can't sign yet — WalletConnect comes in Wave 2.
4. **Telegram** — [@musd_compass_bot](https://t.me/musd_compass_bot): `/yield`, `/carry 2000 borrow`, `/vault 0xfe21B2782B35BE770DD4a7b05f81cE43790D676C`, `/rewards 0xeaC6A75e19beB1283352d24c0311De865a867DAB`, `/trove sample`.
5. **Rewards and trove planner** — [`/rewards`](https://musd-compass.vercel.app/rewards) and [`/trove`](https://musd-compass.vercel.app/trove) → *Try a sample*: unclaimed veMEZO for a real address; a live mainnet trove's ratio, rate, redemption-queue position and safe extra borrow.
6. **My MUSD and Have BTC?** — [`/my`](https://musd-compass.vercel.app/my) → *Try a sample*: each holding (wallet, Savings Vault, Stability Pool) next to the best cash place for that amount, plus the trove and unclaimed veMEZO. On the home page, *Have BTC? See if borrowing MUSD pays* switches to borrowing and states the result in one line; every venue card says what your amount keeps before you go in.
7. **Safety and Borrow → Earn** — [`/vault`](https://musd-compass.vercel.app/vault) → *Try to break it*: an unlimited approval and an unknown contract are refused before any wallet is asked, and an oversized deposit is refused by Mezo testnet in simulation, all without a wallet. With a wallet and test BTC, *Borrow … MUSD and deposit it* opens a testnet trove (200% ratio) and puts the MUSD in the Savings Vault.
8. **API and widget** — [`/developers`](https://musd-compass.vercel.app/developers): free JSON API with curl examples, a one-tag widget ([preview](https://musd-compass.vercel.app/embed)), and a paid x402 endpoint you can try with *Pay 0.001 MUSD & fetch* (testnet MUSD).

> Mezo Buildathon, Wave 1. Spec: [`SPEC.md`](SPEC.md) · design: [`docs/design.md`](docs/design.md) · plan: [`tasks/plan.md`](tasks/plan.md)

## Testnet proof (Mezo testnet, chain 31611)
All transactions and live checks in one list: [`docs/evidence.md`](docs/evidence.md).

Made through [`/vault`](https://musd-compass.vercel.app/vault) from the public dev wallet [`0xfe21…676C`](https://explorer.test.mezo.org/address/0xfe21B2782B35BE770DD4a7b05f81cE43790D676C) on 24–25 Oct 2026:

| Step | Amount | Transaction |
|---|---|---|
| Approve (exact amount, not unlimited) | 100 MUSD | [`0xa5ec9c45…570f`](https://explorer.test.mezo.org/tx/0xa5ec9c450e27dfac27fb18f2ad91d2cdd5e2a1c782472108be93126766b1570f) |
| Deposit into the Savings Vault | 100 MUSD → 100 sMUSD | [`0x1f4ddeb6…8f3c`](https://explorer.test.mezo.org/tx/0x1f4ddeb61396464e32ee63806a35a3e5cf8cb9218613880e24a5324293458f3c) |
| Withdraw (also pays any pending yield) | 10 MUSD | [`0x3045fba8…77cf`](https://explorer.test.mezo.org/tx/0x3045fba85e8551ca6a465567911f96b68ded7a336f99640c51b3104525f777cf) |
| x402 payment for `/api/premium/yields` (25 Oct; the facilitator sent it and paid the gas; Permit2 approval was exactly 0.001, not unlimited; payer and payee are both the dev wallet) | 0.001 MUSD | [`0x0454c620…4997`](https://explorer.test.mezo.org/tx/0x0454c620d5b02fa6dd9ba0fb3f6665894498d15b825cf8730ff47a0683fa4997) |

After these the wallet holds 90 sMUSD and 67.31 MUSD, the vault allowance is back to 0, and [`/api/vault/0xfe21…676C`](https://musd-compass.vercel.app/api/vault/0xfe21B2782B35BE770DD4a7b05f81cE43790D676C) shows the same. A claim is added after the next yield distribution, so it pays a real amount.

## Live re-verification (25 Oct 2026, 05:40–05:55 UTC)
Every number re-checked on the live site against its primary source (chain or Merkl), not only against our API.

- [x] `/api/health`: Mezo mainnet, fallback RPC, Mezo testnet, Ethereum and Merkl all OK (108–224 ms).
- [x] `/api/yields`: 11 of 11 venues OK; borrow parameters live and equal to the chain (1% rate, 0.1% fee, 1,800 minimum debt, 200 gas compensation); Ethereum round trip ≈ $0.16.
- [x] Savings Vault APR recomputed from raw mainnet events: 9 yield events, 11,349 MUSD over 14 days ÷ 7.38M sMUSD = **4.008%**; API 4.008%.
- [x] Stability Pool 14,172,052 MUSD on-chain = API.
- [x] Merkl: 5 live veMEZO listings (Uniswap V4 + 4 nested Curve listings, shown as 2 rows); Uniswap V4 locked 79.93% diluted for 2,000 MUSD = 75.6% on both sides; Curve cash 0.09% / total 7.75%; MEZO $0.00475 on both sides.
- [x] Borrower notice under the new-trove minimum and a readable 400 for bad input.
- [x] Testnet vault: 90 sMUSD + 67.31 MUSD on-chain = `/api/vault`; all 4 proof transactions above are `success`.
- [x] `/api/rewards` sample: 728.10 unclaimed + 105.28 pending veMEZO = Merkl's own response (`amount − claimed`).
- [x] `/api/trove/sample`: reads the live mainnet trove `0x593c…5bb5` (ratio ≈ 9,200%, 1% rate). Mainnet has one open trove today, so the queue shows 0 of 1.
- [x] `/api/premium/yields` unpaid → 402 asking for exactly 0.001 testnet MUSD (`exact`, `eip155:31611`, Permit2) to the dev wallet, extension `eip2612GasSponsoring` only.
- [x] All 10 pages and files answer 200 (`/`, `/vault`, `/rewards`, `/trove`, `/incentives`, `/developers`, `/get-test-musd`, `/embed`, `/embed.js`, manifest).
- [x] Cached `/api/yields` from a browser: p50 50 ms, p95 54 ms (20 requests; target < 1.5 s).
- [x] Telegram bot: `/yield`, `/carry 2000 borrow`, `/vault` match the API (checked 24 Oct from a phone).
- [ ] Telegram bot: `/rewards 0xeaC6A75e19beB1283352d24c0311De865a867DAB` and `/trove sample` (added after that check).
- [x] Tests (26 Oct): 88 unit, 39 end-to-end (axe on every page, light and dark), 25 bot.
- [x] Lighthouse mobile, production build: performance 0.92–0.98, accessibility 1, best practices 1, CLS 0; LCP median 3.1 s simulated (0.1–0.5 s observed).
- [x] PageSpeed Insights on the live URL (25 Oct, before the fixes below): mobile 92 / 100 / 100 / 100 (LCP 3.0 s), desktop 100 / 100 / 100 / 100.
- [x] After the fixes below (production build, Lighthouse mobile ×3): performance 0.96, LCP 2.6 s, FCP 0.8 s, Speed Index 1.2 s, no render-blocking requests.
- [x] Telegram `/rewards` and `/trove sample` match the API (25 Oct, from a phone).
- [ ] CI green on GitHub Actions for the final commit (every earlier run failed at typecheck — fixed below).

## Security review (25 Oct 2026)
Threat model by trust boundary — browsers, the public API, the Telegram webhook, third-party data (Merkl, RPCs), wallets — then a fix and a test for each finding.

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

Accepted, with reasons:
- **zod 3 advisory inside `@x402` 2.28** (GHSA-mrhx-c7xc-m3w5, high): no fix exists within zod 3 and x402 needs zod 3. The server only parses payment headers after refusing any over 16 KB; review again when x402 moves to zod 4 or by 26 Nov 2026.
- **Rate limits are per serverless instance** (in memory): fine for Wave 1 traffic; a shared store is the upgrade if the API is abused.
- **CSP allows inline scripts**: Next's App Router needs them without per-request nonces; everything else is locked to `'self'`.
- `npm audit signatures` couldn't run from the build sandbox; `pip-audit` on the bot: no known vulnerabilities.

## Run locally
```
cd web && npm ci && npm run dev        # http://localhost:3000
cd bot && python -m pip install -r requirements.txt && python -m pytest -q
```
Bot without the webhook (local test, needs your own bot token; delete the webhook first):
```
cd bot && TELEGRAM_BOT_TOKEN=... COMPASS_API_URL=http://localhost:3000 python compass_bot.py --poll
```
Telegram: [@musd_compass_bot](https://t.me/musd_compass_bot) — `/yield [amount]`, `/carry <amount> [borrow]`, `/vault <address>`, `/rewards <address>`, `/trove <address|sample>`, `/help`.

## License
MIT
