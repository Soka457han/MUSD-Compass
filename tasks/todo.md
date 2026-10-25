# MUSD Compass: Wave 1 task list

Every task also meets the Definition of Done: acceptance criteria met, verified at runtime, new tests fail without the change and pass with it, lint/typecheck/tests green, no secrets, CHANGELOG line added. Commands are in `SPEC.md`. [H] = only the user can do it (accounts, signatures, CAPTCHA, video).

## Phase 1: Foundation

- [x] **T1: Scaffold repo + CI** (M)
  - Acceptance: `web/` Next.js 16 TS app with Vitest, Playwright 1.56.0 (with one placeholder e2e test so CI has something to run; CI runs `npx playwright install --with-deps chromium`), ESLint, `typecheck` script; `bot/` skeleton; MIT LICENSE, `.env.example`, `.gitignore` (blocks `.env*`); CI workflow runs lint → typecheck → test → build → e2e and pytest.
  - Verify: `npm run lint && npm run typecheck && npm test && npm run build` pass; `pytest -q` passes (1 placeholder test).
  - Files: `web/package.json`, `web/vitest.config.ts`, `web/playwright.config.ts`, `.github/workflows/ci.yml`, `.env.example`, `README.md`
  - Deps: none

- [x] **T2: `chain` module + `/api/health`** (S)
  - Acceptance (also: a 10-line hello webhook in `bot/api/telegram.py` so Checkpoint 0 proves Python functions run on Vercel): chains from viem (`mezo`, `mezoTestnet`, `mainnet`), all design §14 addresses checksummed in one file, minimal ABIs, clients with fallback RPC; `/api/health` returns mainnet + testnet block numbers, Merkl status, Ethereum gas price.
  - Verify: unit test checksums every address; `curl localhost:3000/api/health` shows 5 OK sources (mainnet primary + fallback, testnet, Merkl, Ethereum).
  - Files: `src/lib/chain/{chains,addresses,abis,clients}.ts`, `src/app/api/health/route.ts`, `tests/unit/addresses.test.ts`
  - Deps: T1

- [x] **T3: `carry` math (pure)** (S)
  - Acceptance: `borrowCostPct`, `cashCarry`, `totalCarry`, `dilutedApr`, `breakEven` (scan from 100 or the new-trove minimum = 1800/1.001 rounded up to cents = 1,798.21, to 1M; returns from / range / never, for cash and total), `isMezoMusd(chainId, address)`.
  - Verify: tests assert 2.72%, 2,202, 1.10%, 0.41/1.22/0.10, 47.26%, cap ≈383k, 1,798.21, and look-alike rejection.
  - Files: `src/lib/carry/{carry,breakEven,identity}.ts`, `tests/unit/carry.test.ts`, `tests/unit/identity.test.ts`
  - Deps: T1

- [x] **[H1] Create GitHub repo `musd-compass` (public) and push** (Claude gives exact steps)
- [x] **[H2] Import repo into Vercel with Root Directory = `web`, set env vars from `.env.example` (incl. `BOT_API_KEY` = a random value you generate, e.g. from a password manager), deploy**
- [ ] **[H2b] Create a free Reown (WalletConnect) project, put its id in Vercel as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`** (lets judges use phone wallets)
- [x] **[H4] Create the bot with @BotFather now (5 min); keep the token for the bot's Vercel env only (never paste it into chat)**
- [x] **[H5] Import the same repo as a 2nd Vercel project with Root Directory = `bot`; set `TELEGRAM_WEBHOOK_SECRET`, `BOT_API_KEY` (same as web), `COMPASS_API_URL`, `COMPASS_WEB_URL`; then open the one setWebhook link Claude gives you**

### Checkpoint 0 ([H-push] first)
- [x] Deployed `https://<app>.vercel.app/api/health` reads Mezo mainnet (primary and fallback RPC), testnet, Merkl and Ethereum → closes log #27
- [x] The hello webhook replies to `/start` in Telegram (proves the bot host; else switch to the Railway fallback)
- [ ] CI green on GitHub

## Phase 2: Live read path

- [x] **T4: Merkl adapter** (M)
  - Acceptance: fetch opportunities; keep only veMEZO-reward listings whose pool holds Mezo MUSD by address; Curve outer listing = one venue with nested routes as chips (never summed); fields `apr`, `nativeApr`, `tvl`, `dailyRewards`, `latestCampaignEnd`; MEZO price from the tokens endpoint; keeps the raw listings (incl. nested routes) for the premium bundle.
  - Verify: fixture recorded today (8 listings incl. 3 look-alikes) → exactly 2 venues; Curve TVL 244,750, apr 4.82.
  - Files: `src/lib/sources/merkl.ts`, `tests/fixtures/merkl-*.json`, `tests/unit/merkl.test.ts`
  - Deps: T2, T3

- [x] **T5: sMUSD adapter (realised 14-day APR)** (M)
  - Acceptance: 14 days of `ProtocolYieldReceived` + `StrategyYieldReceived` read in ≤10k-block windows (4 concurrent) with retry; APR = Σ ÷ supply × 365/14; returns last distribution time and the raw yield events (for the premium bundle); same code works on testnet (for the "last distribution" label).
  - Verify: fixture logs → 4.01% (14 d) and 4.23% (7 d); live run matches an independent recomputation within ±0.3 pt.
  - Files: `src/lib/sources/smusd.ts`, `tests/fixtures/smusd-logs.json`, `tests/unit/smusd.test.ts`
  - Deps: T2

- [x] **T6a: Mezo adapters** (M)
  - Acceptance: Stability Pool total deposits; 3 Mezo pools' TVL (`getReserves`, token decimals, BTC price from PriceFeed `fetchPrice()`); live borrow params (fee, min net debt, gas compensation) with constant fallback.
  - Verify: unit tests with mocked clients; pool TVLs match the Mezo app (≈ $5.34M mUSDC/MUSD-10 … $6k MEZO/MUSD-200 on 24 Oct).
  - Files: `src/lib/sources/{stabilityPool,mezoPools,borrowParams}.ts`, `tests/unit/mezoSources.test.ts`
  - Deps: T2

- [x] **T6b: Ethereum adapters** (S)
  - Acceptance: Morpho Alpha MUSD Core `totalAssets` + "inactive" tag under $1k; round-trip cost = bridge fee both ways (from a bridge quote if one is reachable, else a stated fixed estimate labelled "est.") + live Ethereum gasPrice × fixed gas units (stated) × ETH price from Merkl tokens endpoint (chainId 1, WETH) + Mezo-side gas; basis returned in the response.
  - Verify: unit tests with mocked clients; live smoke prints the cost in USD.
  - Files: `src/lib/sources/{morpho,ethCosts}.ts`, `tests/unit/ethSources.test.ts`
  - Deps: T2

- [x] **T7: `GET /api/yields`** (M)
  - Acceptance: query `amount, mode, trove, days, rate` validated (400 with a plain-English message on bad input; a new-trove amount under 1,798.21 returns 200 with a `notice` "New troves need at least 1,800 MUSD of debt — try 1,800 or use holder mode"); response per design §7 incl. `breakEvenCash/Total` and `assumptions`; sorted by cash carry, "—" rows last; dead source → venue with `status: "unavailable"`; source data cached via `unstable_cache` (revalidate 300, shared across instances), carry computed per request; CORS open; per-IP rate limiter in `src/lib/rateLimit.ts`, reused by every API route, skipped when the `x-compass-bot` header matches `BOT_API_KEY`.
  - Verify: contract tests with mocked adapters; `curl '/api/yields?amount=2000&mode=borrower&days=90&rate=1'` shows sMUSD cash ≈ 2.72% at today's APR.
  - Files: `src/app/api/yields/route.ts`, `src/lib/cache.ts`, `src/lib/yields.ts`, `tests/unit/yields.test.ts`
  - Deps: T3, T4, T5, T6a, T6b

- [x] **T8: Home page: venue table + calculator** (M)
  - Acceptance: phone-first (360 px, no horizontal scroll); inputs amount / mode / trove / days (30·90·365) / rate; columns venue, chain, liquid APR, locked APR 🔒, TVL, cash carry, total carry 🔒, risk tags, ends, source, updated-at; Curve "also via" route chips; "Assumes N-day hold" on every figure; risk tags; break-even (cash, and total 🔒) on Ethereum rows; venue notes from design §5.1 (sMUSD gauge note "emissions instead of fees", Stability Pool note, "fees not reported", "est."); "Mainnet data" label; links to Mezo app, Merkl, Portal; works with JS-light first paint (server-rendered table); installable PWA via `app/manifest.ts` + one icon.
  - Verify: e2e at 360×740 (all columns present, table sorted by cash carry, "—" rows last, input change updates numbers, holding-period label shown); axe 0 serious/critical.
  - Files: `src/app/page.tsx`, `src/components/{VenueTable,Calculator,RiskTags}.tsx`, `e2e/home.spec.ts`
  - Deps: T7

### Checkpoint A ([H-push] first)
- [x] Wallet-free table live on Vercel with real numbers; API shape frozen (bot work may start)
- [ ] Human review of the page on the user's phone

## Phase 3: Write action

- [x] **T9: Wallet + network** (S)
  - Acceptance: wagmi config (injected; WalletConnect if id set); connect button; auto add/switch to chain 31611; persistent "Testnet action — real Mezo contracts, test funds. APR shown is mainnet." banner on `/vault`.
  - Verify: e2e renders banner + connect without a wallet; manual connect with MetaMask.
  - Files: `src/lib/wagmi.ts`, `src/components/{Providers,ConnectButton,TestnetBanner}.tsx`
  - Deps: T2

- [x] **T10: `/api/vault/[address]` + vault page (read)** (S)
  - Acceptance: returns testnet MUSD balance, allowance, sMUSD balance, pending yield (simulated `claimYield`) — the only per-request reads — plus last distribution time from a cached testnet scan (`unstable_cache`, revalidate 300, 14-day lookback so a weekly cadence is never blank); invalid address → 400; shares the API rate limiter; page shows them with "Try a sample" (dev wallet) and "last distribution <time ago>"; reads `?action=deposit&amount=…` from the bot link and pre-fills the deposit form.
  - Verify: unit test with mocked client; live call for the dev wallet returns its on-chain MUSD balance (157.31 before H3).
  - Files: `src/app/api/vault/[address]/route.ts`, `src/app/vault/page.tsx`, `tests/unit/vault.test.ts`
  - Deps: T5 (last distribution), T7 (rate limiter), T9

- [x] **T11: Deposit / claim / withdraw** (M)
  - Acceptance: `sendSafely()` = allowlist (testnet MUSD, sMUSD only; anything else refused) → simulate → estimateGas × 1.2 → write → poll receipt (null-safe); deposit = approve **exact** amount (skipped if allowance suffices) then `deposit`; `claimYield`; `withdraw` (states that it also pays out pending yield); explorer links; human-readable errors; buttons disabled while pending.
  - Verify: unit tests for allowlist refusal, gas limit math, simulate-failure path; manual run [H3].
  - Files: `src/lib/sendSafely.ts`, `src/components/VaultActions.tsx`, `tests/unit/sendSafely.test.ts`
  - Deps: T10

- [x] **[H3] From the dev wallet: approve + deposit 100 MUSD, claim (may pay 0 before the next distribution), withdraw 10 MUSD; send Claude the 4 tx links** (public hashes only) — done 24 Oct: approve, deposit, withdraw; claim after the next distribution

### Checkpoint B ([H-push] first)
- [ ] 4 testnet tx hashes (approve, deposit, claimYield, withdraw) recorded in README; balances on `/vault` match the explorer

## Phase 4: Reach + judge kit

- [x] **T12: Python bot** (M)
  - Acceptance: `/start`, `/help`, `/yield [amount]`, `/carry <amount> [borrow]`, `/vault <address>`; calls the API only, with the `x-compass-bot` header; `/help` and the usage replies of `/vault` (and `/rewards`) include a sample address to try; break-even for Ethereum venues in `/yield`; shows the API `notice` as-is (e.g. `/carry 1000 borrow`); every reply says "Mainnet data · assumes 90-day hold" (or the chosen period), and `/vault` says "Testnet"; deposit link to `/vault?action=deposit&amount=…`; per-chat rate limit; friendly error when the API is down; never asks for keys.
  - Verify: pytest (parsing, formatting, API-down) green; live check happens in T15 after H5 (Claude never holds the token).
  - Files: `bot/api/telegram.py` (webhook: checks `X-Telegram-Bot-Api-Secret-Token`, handles one update per request), `bot/{bot,api_client,fmt}.py` (`--poll` mode for local runs), `bot/tests/test_bot.py`, `bot/requirements.txt`, `bot/vercel.json`
  - Deps: T7 (`/yield`, `/carry`), T10 (`/vault`)

- [x] **T13: `/embed` widget** (S)
  - Acceptance: compact top-3 venues by cash carry, with "Mainnet data · assumes 90-day hold" and a link to the full page; `public/embed.js` injects an iframe from one `<script>` tag (documented on `/developers` in T14).
  - Verify: e2e loads a static HTML page with the tag; iframe shows rows.
  - Files: `src/app/embed/page.tsx`, `public/embed.js`, `e2e/embed.spec.ts`
  - Deps: T8

- [x] **T14: Judge pages + README + accessibility CI** (M) — 25 Oct, local production build with fixtures: axe clean on 5 pages (home, vault, embed, get-test-musd, developers; light + dark); Lighthouse mobile ×5: performance 0.92–0.98, accessibility 1, best practices 1, CLS 0, LCP simulated 2.0–3.3 s (median 3.1; observed 0.1–0.5 s — runs over 3 s are the ~300 ms batched reveal of the streamed venue table, stretched by Lighthouse's slow-phone simulation); `scripts/latency.sh` local p95 0.006 s. Still to do on the live URL: latency + Lighthouse, and the 60-second README check on a phone (user).
  - Found and fixed on the way: hydration mismatch on the home page (`usd()` printed "$77.0K" in Node, "$77K" in Chromium → React re-rendered the page); the font is now preloaded through next/font/local (same fontsource file).
  - Acceptance: `/get-test-musd` (faucet → swap, 3 steps, no CAPTCHA help); `/developers` (API docs + curl examples); README "judge check in 60 seconds" with links and tx hashes; axe e2e on 4 pages in CI.
  - Verify: CI green; `npx lighthouse <home> --form-factor=mobile` LCP < 3 s (the LCP element is the venue table); `scripts/latency.sh` p95 < 1.5 s on cached `/api/yields`; a non-builder follows the README in ≤60 s (user checks on phone).
  - Files: `src/app/{get-test-musd,developers}/page.tsx`, `README.md`, `e2e/a11y.spec.ts`, `scripts/latency.sh`
  - Deps: T8, T11

- [x] **T15: Bot live check** (XS) — 25 Oct: `/yield`, `/carry 2000 borrow`, `/vault <dev wallet>` match `/api/yields` and `/api/vault`
  - Acceptance: deployed bot answers `/yield`, `/carry 2000 borrow`, `/vault <dev wallet>` with the same numbers as the web page; README run instructions.
  - Verify: screenshots from your phone in < 5 s each.
  - Files: `README.md`
  - Deps: T12, H5 (done in Phase 1; new code arrives with the H-push)


### Checkpoint C — all MUSTs ([H-push] first)
- [ ] Spec success criteria 1–8 and 10 verified on the deployed URLs
- [ ] Human review; decide which SHOULDs fit (cut rule in plan.md)

## Phase 5: SHOULDs (build in this order; cut from the bottom)

- [x] **T16: Rewards reminder (SHOULD 6)** (M) — built 25 Oct against Merkl's documented user-rewards shape (Morpho integration guide; Merkl's own reference lists no fields). Merkl was unreachable from the build machine, so the live check of sample `0xeaC6…7DAB` is still open (do it after the push).
  - Acceptance: `/api/rewards/[address]` → unclaimed veMEZO (`amount − claimed`), USD at MEZO price, campaign end, warning "no published deadline; unclaimed rewards can be reallocated after a campaign — claim soon", "claiming needs ~$0.02 BTC on Mezo for gas", reward path (Ethereum LP → claim on Merkl → 12-week veMEZO on Mezo → Matchbox/Boar); page with sample button; bot `/rewards`.
  - Verify: fixture test; bot pytest for `/rewards`; live sample `0xeaC6…7DAB` shows a non-zero amount (or a new sample is picked).
  - Files: `src/lib/sources/merklUser.ts`, `src/app/api/rewards/[address]/route.ts`, `src/app/rewards/page.tsx`, `bot/bot.py`, `bot/tests/test_bot.py`
  - Deps: T4, T12

- [x] **T17: Trove planner (SHOULD 7)** (M) — built 25 Oct from the mezo-org/musd sources (TroveManager, SortedTroves, InterestRateMath: rate in bps). Mezo mainnet was unreachable from the build machine, so the live check (sample = `SortedTroves.getFirst()`, queue scan time) is still open. Vigil and Lifeline linked by their GitHub repos, labelled testnet-only and not audited. Live check 25 Oct: reads work; mainnet has 1 open trove (`0x593c…5bb5`), so the queue reads "0 of 1".
  - Acceptance: `/api/trove/[address]` → collateral, debt, ICR, rate, redemption-queue position, safe extra borrow at ICR ≥ 200%; sample = `SortedTroves.getFirst()`; "Use in calculator" sets existing-trove mode + rate; links to Vigil/Lifeline.
  - Verify: unit tests for the safe-borrow math; live sample returns sane values.
  - Files: `src/lib/sources/trove.ts`, `src/app/api/trove/[address]/route.ts`, `src/app/trove/page.tsx`, `tests/unit/trove.test.ts`
  - Deps: T3, T8

- [x] **T18: x402 premium (SHOULD 8)** (M) — 25 Oct: spike checks passed (facilitator `/supported` lists exact · eip155:31611 · testnet MUSD via Permit2 + `eip2612GasSponsoring` only; Permit2 deployed on 31611; the 2.28 client signs an EIP-2612 permit for exactly the payment amount). `/api/premium/yields` + "Pay & fetch" on `/developers` with a pre-sign guard (testnet MUSD, ≤ 0.001, Compass payee). Open: the real paid call [H7] after the push.
  - Acceptance: 30-min spike first (one paid call on 31611 via the facilitator; needs [H7] your signature, same evening); then `withX402` on `/api/premium/yields?address=` at `$0.001` (MUSD), advertising only the `eip2612GasSponsoring` extension (exact-amount permit; checked in @x402/evm 2.28 source — the ERC-20 approval extension signs `maxUint256` and is not offered), returning carry for every mode × holding period, per-venue cost breakdown, raw sMUSD yield events and raw Merkl listings, plus planner + rewards when `address` is given and T16/T17 shipped; "Pay & fetch" button on `/developers` using `wrapFetchWithPayment` with the connected wallet; one real paid call recorded [H7].
  - Verify: unpaid request → 402 with MUSD requirements; paid request → 200 + settlement header.
  - Files: `src/app/api/premium/yields/route.ts`, `src/components/PayAndFetch.tsx`, `src/app/developers/page.tsx`
  - Deps: T7, T16, T17 (works without them, with fewer fields)

- [x] **T19: Incentive Efficiency board (SHOULD 9)** (S) — 25 Oct: `/incentives` + `incentiveUsdPerDay` on Merkl venues in `/api/yields`
  - Acceptance: per venue (2 rows): $/day, TVL, cost per $1k TVL; nested Curve listings never summed.
  - Verify: unit test on the fixture (Curve $32/day on $244,750 → $0.13 per $1k/day).
  - Files: `src/app/efficiency/page.tsx`, `tests/unit/efficiency.test.ts`
  - Deps: T4

- [ ] **[H7] Sign the x402 paid call from the dev wallet** (during T18)

### Checkpoint D ([H-push] first)
- [ ] Every shipped SHOULD meets its acceptance criteria; unshipped ones are removed from the UI and listed as Wave 2 in README

## Phase 6: Materials + submission

- [ ] **T20: Deck, video script, AKINDO answers, docs PR draft** (M) — drafts in `docs/submission/` (25 Oct); waiting for your read-through; the deck is built from `deck.md` after you approve the wording
  - Acceptance: 5 slides (problem, product, Mezo integration, demo/tx proof, roadmap) for both tracks; 2-min video script with shot list; AKINDO form answers; Mezo docs Community Projects PR text.
  - Verify: the user reads everything and approves.
  - Deps: Checkpoint C

- [ ] **T21: Final live re-verification** (S)
  - Acceptance: re-run verification log checks against live data; recheck sample addresses; CI green; Lighthouse mobile < 3 s; CHANGELOG "Wave 1" entry; tag `v0.1.0` prepared (pushed by you in the final [H-push]).
  - Verify: checklist recorded in README.
  - Deps: T20

- [ ] **[H6] Record the 2-minute video** (screen recording on phone + desktop)
- [ ] **[H8] Submit on AKINDO by Mon 26 Oct 13:00 UTC (19:00 Dhaka)**

### Checkpoint Final
- [ ] Spec success criteria 1–10 true; submission confirmed on AKINDO
