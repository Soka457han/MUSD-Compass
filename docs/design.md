# MUSD Compass — design (v8, 24 Oct 2026)

v8 (after 7 recheck passes) settles the three open decisions with research (sources in `research/compass-decisions.md`) and fixes what a whole-document recheck found. Every fact is VERIFIED on 24 Oct unless marked INFERRED or PENDING; the log is §15. Live numbers are "as of 24 Oct".

## 1. Intent
Pitch: **"Borrow at 1%, earn where Mezo pays."**
MUSD Compass shows every place a MUSD holder can earn — Mezo, Ethereum, later Base — as **net carry** after costs, always as two numbers: **cash** (what you can spend) and **total** (cash + locked veMEZO 🔒). It lets the user act on Mezo in a few taps, and it runs where the Mezo app does not: phones, Telegram, any website, AI agents.

Why it should exist:
- The Mezo app compares only Mezo-native pools and vaults, on desktop only (at phone width: "Please use a larger window to continue").
- Mezo pays veMEZO on Ethereum MUSD pools through Merkl (5 live campaigns; Uniswap V4 USDC-MUSD 49.9% on $35.5k TVL, Curve family 4.8%). Those rewards are **locked 12 weeks** once claimed, have **no published claim deadline**, and Merkl lets a campaign manager **reallocate unclaimed rewards** after a set period (1 day–1 year after the campaign) — so unclaimed rewards are at risk. Neither the Mezo app nor any of the 40 Wave-1 submissions shows them.
- Track 2 asks for "matching and discovery platforms" and "aggregators for Mezo ecosystem products".

## 2. Users and what each gets
| User | Question | What Compass gives |
|---|---|---|
| MUSD holder | "Where should my MUSD be right now?" | All venues ranked by cash carry, locked shown apart, risk tags, one tap to the Savings Vault |
| Borrower | "Does borrowing to earn elsewhere pay, and how much can I borrow safely?" | Net carry at their own rate + safe extra borrow (SHOULD) |
| Ethereum MUSD LP | "Do I have Mezo rewards to claim?" | Claim reminder + reward path to Mezo (SHOULD) |
| Agent / developer | "Machine-readable MUSD yields" | Open JSON API; MUSD-paid x402 endpoint (SHOULD) |
| Mezo team | "Where are our emissions working?" | Embeddable widget; Incentive Efficiency board (SHOULD) |

## 3. Goals mapped to the judging criteria
- **Mezo Integration (30%)** — MUST: reads sMUSD (yield events, supply), StabilityPool, PriceFeed, Mezo pools, live borrow parameters (BorrowerOperations: min net debt, fee); writes on testnet: sMUSD `deposit` / `withdraw` / `claimYield`; Merkl campaigns; links to Mezo app pages, Portal, Merkl claim. SHOULD adds: TroveManager / SortedTroves / InterestRateManager (planner), Merkl per-user rewards, MUSD x402 payment. The deck claims only what shipped.
- **Product & viability (30%)** — pushes MUSD into Mezo's own promoted product (Savings Vault: "the easiest way to earn yield on Mezo") and into pools Mezo already pays for; routes to existing tools instead of rebuilding them; reaches users the Mezo app cannot (mobile, chat).
- **Technical (20%)** — one source of truth (Next.js API), one adapter per source, tests on carry math and the identity guard, CI incl. accessibility check, simulate-before-sign, explicit gas limits, cached upstream calls.
- **UX (10%)** — phone-first, wallet-free reading, one bot command, plain-language risk tags, every number says its assumption ("Assumes 90-day hold"), clear mainnet-data vs testnet-action labels.
- **Materials (10%)** — judge path in 60 seconds, real testnet tx links, deck, 2-minute video, honest limits.
- Tracks: **Track 1 DeFi** ("borrowing, lending, looping, and yield with MUSD or MEZO") — carry calculator, Savings Vault, planner; **Track 2 Access & Distribution** — phone, Telegram, widget, API/x402. One product, two pitches; the deck and form answers name both. Judging weights above apply to both.
- Mezo team's stated priority (AKINDO comment, 19 Oct): **"it works as expected; users can fully test all features; no clear security flaws."** → every feature, SHOULDs included, must be testable by a judge without their own position (§5.5).

## 4. Non-goals and anti-goals
Non-goals (Wave 1): own smart contract; transactions on Ethereum/Base (links only); custody or auto-execution; mainnet writes; APY forecasts; languages other than English; WhatsApp; MCP; `api.mezo.org` (blocked for servers); gauge staking of sMUSD.
Anti-goals (failure even if it "works"):
- Treating MetaMask **mUSD**, Salt **smUSD** or any look-alike as Mezo **MUSD**. A Merkl search for "MUSD" today returns three of them (Monad, Pharos). Match by token address and reward token, never by symbol.
- Ranking by veMEZO as if it were cash. Merkl values veMEZO at full MEZO spot price; it cannot be sold for 12 weeks. Cash carry ranks; total carry is shown beside it.
- Adding sMUSD fee yield and gauge emissions for one position. Staked sMUSD earns MEZO emissions **instead of** fees.
- Suggesting a borrow below a safe collateral ratio, or assuming every trove pays 1%.
- A judge seeing an empty page, or not being able to test a feature.
- Mixing mainnet numbers and testnet actions without saying so.

## 5. Scope
### Wave 1 MUST (deadline 26 Oct 15:00 UTC = 21:00 Dhaka)
1. **Venue table** (web page, `/api/yields`, embeddable `/embed`). Data = **Mezo mainnet + Ethereum**. Columns: venue, chain, liquid APR, locked APR 🔒, TVL, cash carry, total carry, risk tags, ends, source, updated-at. Default sort: **cash carry**.
   - **MUSD Savings Vault (sMUSD)**: liquid APR = realised 14-day APR = Σ(`ProtocolYieldReceived` + `StrategyYieldReceived`) over 14 days ÷ total supply × 365/14 (today 4.01%; the 7-day figure is 4.23%, and an unstaked 2M holder's actual claims give 4.29%). Fourteen days always spans two weekly distributions (Thu ~00:20 UTC), so a distribution landing minutes early or late can't double or zero the number, as it could with 7 days. Worked examples below keep 4.23% as their input. Note: "Staking sMUSD in the Mezo gauge swaps this fee yield for MEZO emissions — see Mezo app." Link to Mezo Vaults page.
   - **Stability Pool**: size + note "protocol-seeded, no direct incentives, earns BTC only from liquidations". No APR.
   - **Mezo MUSD pools** — the six MUSD pools the Mezo app lists (addresses §14), incl. the concentrated mUSDC/MUSD-10 pool that holds most liquidity: TVL = the pool's token balances × prices (BTC from PriceFeed, MEZO from Merkl, stables $1) (today ≈ $5.34M mUSDC/MUSD-10, $77k BTC/MUSD, $46k BTC/MUSD-200, $13k MUSD/mUSDT, $12k mUSDC/MUSD, $6k MEZO/MUSD-200); APR → link to Mezo app Pools page (it already shows it). mUSDC/mUSDT here are Mezo's bridged stablecoins, not look-alikes of MUSD.
   - **Merkl Ethereum campaigns** (filter: reward token = veMEZO and pool contains MUSD `0xdD46…F186`): Uniswap V4 USDC-MUSD, and Curve MUSD/USDC/USDT as **one row** whose numbers come from the outer Merkl listing (LP holding: TVL $245k, 4.82%); the gauge, Stake DAO and Convex listings are nested slices of the same reward stream (their TVLs add up to the gauge's), so they appear only as "also via" route chips and are never summed. 5 live campaigns = 1 Uniswap + 4 Curve listings. Liquid APR = Merkl `nativeApr` when present (Curve 0.12%), otherwise "fees not reported" and counted as 0. Locked APR = Merkl `apr` **after your deposit**, est. `apr × tvl ÷ (tvl + amount)` (Uniswap V4: 49.92% × 35,502 ÷ 37,502 = 47.26% for 2,000 MUSD; V4 out-of-range liquidity earns nothing, so it says "est."). Ends = `latestCampaignEnd` (7-day campaigns, renewed weekly).
   - **Morpho Alpha MUSD Core** (Ethereum): "inactive" tag while TVL ≈ $18.
2. **Net carry calculator** — inputs: amount = MUSD you put to work (default 2,000), mode, holding period (30 / **90** / 365 days, default 90), borrow rate (Borrower only; 1–5%, default 1% or the trove's own rate when known).
   - Costs, both modes: Ethereum venues add round-trip bridge + gas, amortised over the holding period. **Break-even**, two numbers like everything else: the amount range where the venue's **cash** carry (primary) and its **total** carry 🔒 beat sMUSD's cash carry (the no-bridge default). Found by scanning amounts from 100 (holder) or `ceil(1800 ÷ 1.001)` ≈ 1,798.21 (new trove: amount + fee ≥ 1,800) up to 1M MUSD; shown as "from X", "X–Y" (dilution can cap it) or "never at today's rates". Today Uniswap V4 shows cash "never (fees not reported)" and total "X – ~383k 🔒" (above ~383k, dilution pushes its locked APR below sMUSD's 4.23%). Uniswap V4 is a two-token range position (half in USDC; out-of-range earns nothing) — risk tags, not costs.
   - Borrower, **new trove** (default): debt = amount + 0.1% fee + 200 MUSD gas compensation (amount + fee must be ≥ 1,800). Interest is charged on the whole debt, so the interest cost per MUSD put to work = rate × debt ÷ amount (1% → 1.10% at 2,000). The 200 comes back on close, so only its interest is a cost.
   - Borrower, **existing trove** (a MUST toggle; the user types their rate, or the SHOULD planner fills it): debt added = amount + 0.1% fee, at the trove's own rate, no minimum, no 200.
   - Both: the fee is amortised ×365/days (0.41%/yr at 90 days).
   - Cash carry = liquid APR − costs. Total carry = cash carry + locked APR 🔒. Every figure says "Assumes 90-day hold" (or the chosen period). veMEZO unlocks 12 weeks after each claim, so most locked rewards are still locked when the hold ends — one more reason cash carry ranks.
   - Rows with no APR (Stability Pool, Mezo pools, inactive Morpho) show carry "—" and sort last.
   - Example: Borrower, 2,000 MUSD, 90 days, 1% → sMUSD cash carry 4.23 − 1.10 − 0.41 = **2.72%** (debt 2,202).
3. **Savings Vault actions on Mezo testnet**: connect any EVM wallet → switch/add chain 31611 → approve **exact amount** → `deposit`; `withdraw` (1 sMUSD = 1 MUSD; it also pays out pending yield); `claimYield` (pending yield shown by simulating `claimYield`, because `claimableYield()` returns 0; testnet distributions have landed weekly on Thursday ~00:20 UTC (8, 15, 22 Oct) plus occasional extra ones (3 on 24 Oct), so a fresh deposit shows "0 until the next distribution — last one <time ago>"; no promised date). Every write is simulated first and sent with gas limit = estimate × 1.2. Banner: "Testnet action — real Mezo contracts, test funds. APR shown is mainnet."
4. **Telegram bot (Python, thin; calls the API only)**: `/yield [amount]` (top venues, default 2,000), `/carry <amount> [borrow]` (`borrow` = switch to borrower mode, new trove; defaults 90 days, 1%; tweak on the web), `/vault <address>` (testnet sMUSD balance + pending yield). Signing is handed to the phone web page by a link (`/vault?action=deposit&amount=…`).
5. **Judge kit**: wallet-free view; "Get test MUSD in 3 steps" page (faucet 0.05 BTC + 100 MEZO per ~24 h, single-use CAPTCHA, swap BTC→MUSD on testnet.mezo.org); **"Try a sample" buttons** for every address-based feature (planner: a live trove from `SortedTroves.getFirst()`; rewards: `0xeaC6A75e19beB1283352d24c0311De865a867DAB`, rechecked before submission; vault: dev wallet `0xfe21B2782B35BE770DD4a7b05f81cE43790D676C` after Compass's first deposit, made early so it has pending yield by judging); README "judge check in 60 seconds"; deck (5 slides); 2-minute video; AKINDO form answers; both tracks.

### Wave 1 SHOULD (cut from the bottom if time runs out)
6. **Claim reminder + reward-loop view**: address → unclaimed veMEZO (`amount − claimed` from Merkl), campaign end, the warning "no published deadline; unclaimed rewards can be reallocated after a campaign — claim soon" (never a made-up date), "needs ~$0.02 BTC on Mezo for gas"; path Ethereum LP → claim on Merkl → 12-week veMEZO on Mezo → use via Matchbox/Boar. Bot: `/rewards <address>`.
7. **Trove-aware planner** (mainnet read): address → collateral, debt, ICR, trove interest rate, redemption-queue position; safe extra borrow keeping ICR ≥ floor (default 200%); fills the calculator's borrow rate; links to Vigil/Lifeline for protection.
8. **x402 premium endpoint** on testnet: `/api/premium/yields?address=` for 0.001 MUSD — one agent-friendly bundle: carry for every mode × holding period, per-venue cost breakdown, raw source data (each sMUSD yield event, each Merkl listing incl. nested routes), and, with `address`, the trove planner + unclaimed rewards. The free API keeps every number a human sees; premium sells convenience, not hidden data. No history; a **"Pay & fetch" button** on the developers page so a judge can make a paid call from their wallet; one real paid call recorded.
9. **Incentive Efficiency board**: per venue (2 rows today: Uniswap V4, Curve outer listing — nested Curve listings never summed), $/day (`dailyRewards`) vs TVL → cost per $1k TVL.

### COULD
10. `/watch` APR-change alerts. 11. Signature-nonce watch (BorrowerOperationsSignatures shares one nonce across all signed actions).

### Wave 2 (by 15 Nov)
WhatsApp; `/watch` alerts (if not shipped as COULD); mainnet x402; Base data — Aero (Aerodrome merged into Aero on 22 Oct; Mezo gauges "Aero USDC/MUSD" and "Aero MEZO/MUSD", MEZO rewards paused until reconnected) and Ditto dMUSD vault; haircut slider for veMEZO; sMUSD stake-in-gauge toggle (fees vs emissions, never both); MCP server; in-app bridge; usage numbers; Discord user tests; docs Community Projects PR follow-up.

## 6. Accessible everywhere
Phone/PWA (360 px, installable, no wallet to read) · Telegram now, WhatsApp in Wave 2 · one-script-tag widget · open API + x402 now, MCP later · any EVM wallet via injected or WalletConnect (not the Passport BTC-wallet path, which Mezo is sunsetting) · Mezo + Ethereum now, Base later · WCAG AA, keyboard, screen-reader labels, axe-core in CI · text-first bot, cached API, small pages.

## 7. API (the one source of truth; web, widget, bot and x402 all use it)
- `GET /api/yields?amount=&mode=holder|borrower&trove=new|existing&days=&rate=` → venues with liquidApr, lockedApr, costs, cashCarry, totalCarry, breakEvenCash, breakEvenTotal, tvl, ends, source, updatedAt, and the assumptions used. The bot shows break-even only for Ethereum venues.
- `GET /api/vault/{address}` (testnet sMUSD balance, pending yield) · `GET /api/rewards/{address}` (SHOULD) · `GET /api/trove/{address}` (SHOULD) · `GET /api/premium/yields?address=` (x402, SHOULD; same numbers as the free API, bundled).

## 8. Security, privacy, reliability rules
- No private keys anywhere; the bot never asks for seed phrases; all signing happens in the user's wallet.
- Exact-amount approvals only; simulate every write (Mezo RPC supports `eth_call` state overrides); explicit gas limit = estimate × 1.2 (Mezo charges at least 50% of the limit).
- Never use `isTrustedForwarder` / meta-transaction paths (5 Oct veBTC exploit).
- Identity guard for MUSD on every chain; checksummed addresses; refuse unknown contracts.
- Secrets (bot token, RPC keys, WalletConnect id, x402 payee) only in environment variables; rate-limit the API and bot.
- Privacy: MUST/SHOULD features store nothing (every command takes the address each time), so the bot needs no database. Only `/watch` (COULD) would store chat id ↔ public address, deletable with `/forget`.
- Reliability: 5-minute server cache; poll receipts (public RPC sometimes returns null receipts); log queries in ≤10,000-block windows, sequential (Boar RPC rate-limits parallel bursts; mainnet ≈ 3.8 s/block, so 14 days ≈ 32 windows, read 4 at a time with retry — computed into the shared 5-minute cache, never per request); Boar RPC for mainnet reads with Mezo/Validation Cloud as fallback; bot reachable during judging (27 Oct–1 Nov and 16–22 Nov) — a Vercel webhook function, so nothing to keep awake.

## 9. Approach (chosen: A)
Next.js (TypeScript, built with Claude Code) owns all logic and the API; a thin Python Telegram bot calls the API. Deploy: two free Vercel projects — web/API, and the bot as a Python webhook function (Railway as fallback). Rejected: all-TypeScript (no Python practice), all-Python (wallet UI too slow).

## 10. Composability and long-term commitment
Composability: read Mezo's own contracts and Merkl (which the Mezo app itself calls); write into Mezo's Savings Vault; route to Portal, Merkl, Matchbox/Boar, Vigil/Lifeline, MezoRoute, the Mezo app; publish API, widget, x402 endpoint and identity guard for others; PR to the Mezo docs **Community Projects** page (precedent #300 merged same day; never depend on it).
Long-term: public mainnet read-only launch in Wave 1; Wave 2 (15 Nov) as in §5; Dec 2026 mainnet Savings/Borrow writes after review, languages; Q1 2027 apply to the Mezo Ignition Program; MIT licence, API docs, changelog per wave, weekly Discord update, X build-in-public threads; revenue via x402 premium API.

## 11. Constraints
Solo builder (some JS, learning Python) with Claude Code; ≈48 h from 24 Oct 15:00 UTC (21:00 Dhaka) to the deadline, realistically 25–30 working hours. Test funds ready: dev wallet `0xfe21B2782B35BE770DD4a7b05f81cE43790D676C` (the user's own, created for this; Claude never holds its key) holds 0.048 BTC, 100 MEZO, 157.31 MUSD on testnet (do not deposit them anywhere before Compass's own first deposit).

## 12. Decisions (settled by research, 24 Oct)
| Decision | Answer | Why |
|---|---|---|
| Carry display | Two numbers, **sort by cash**; total (+veMEZO 🔒) beside it; locked APR its own column | DefiLlama: "Omit any locked rewards", "Use unboosted (lower bound)"; Curve/Yearn/Morpho keep base and rewards apart |
| Holding period | **90 days** default, 30/365 toggles, printed on every figure | ≈13 weekly epochs, near the 12-week lock; 30 d lets one-off costs dominate (1.22%/yr), 365 d hides them (0.10%); APRs reset weekly, so a year-long projection overstates certainty |
| Borrow rate | Input, 1–5%, default 1% | Mezo fees page: 1–5% fixed at open |
| Write action | **Savings Vault** deposit / withdraw / claimYield | Mezo-built and promoted, real fee yield, no withdrawal fee or time-lock (safe for judges); Stability Pool has no direct incentives and is lumpy |
| `/yield` default | 2,000 MUSD | Round size just above the 1,800 minimum borrow |

## 13. Left to the builder
Component library and styling; cache interval (≈5 min); risk-tag wording; repo layout; Ethereum bridge+gas estimate (fixed with stated basis, or live from a public Ethereum RPC); deck design.

## 14. Key addresses (official deployment files, mezo-org/musd)
- Testnet: MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`; sMUSD `0x6f461c68B2c5492C0F5CCEc5a264d692aA7A8e16` (ignore the unverified `0xe7ca…8532`); StabilityPool `0x1CCA7E410eE41739792eA0A24e00349Dd247680e`; TroveManager `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0`; PriceFeed `0x86bCF0841622a5dAC14A313a15f96A95421b9366`; SortedTroves `0x722E4D24FD6Ff8b0AC679450F3D91294607268fA`; HintHelpers `0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6`; BorrowerOperations `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`; MUSD/BTC pool `0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9`.
- Mainnet: MUSD `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186` (same address on Ethereum and Base); sMUSD `0xb4D498029af77680cD1eF828b967f010d06C51CC` (vaultGauge `0x677817bf3e44b90e8f95222f75e2950b7904a401`, holds 72% of supply); StabilityPool `0x73245Eff485aB3AAc1158B3c4d8f4b23797B0e32`; TroveManager `0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193`; PriceFeed `0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88`; SortedTroves `0x8C5DB4C62BF29c1C4564390d10c20a47E0b2749f`; BorrowerOperations `0x44b1bac67dDA612a41a58AAf779143B181dEe031`; InterestRateManager `0x4a453700d157717fe02fb62e7700ed7845048285`.
- Mainnet Mezo pools: concentrated mUSDC/MUSD-10 `0xcc372b7e15535ab225fe17c1075831d38ef7ac1a`, BTC/MUSD-200 `0x9cbc1537d255768b431488305b1c7efc2ac95022`, MEZO/MUSD-200 `0x1d6e8d24c133535f2d00676f66a0e824f84765ff` (CLFactory `0xBB24AF5c6fB88F1d191FA76055e30BF881BeEb79`); basic MUSD/BTC `0x52e604c44417233b6CcEDDDc0d640A405Caacefb`, MUSD/mUSDC `0xEd812AEc0Fecc8fD882Ac3eccC43f3aA80A6c356`, MUSD/mUSDT `0x10906a9E9215939561597b4C8e4b98F93c02031A` (PoolFactory `0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248`); mUSDC/mUSDT have 6 decimals. MEZO token `0x7B7c000000000000000000000000000000000001`. BTC token `0x7b7C000000000000000000000000000000000000`.
- Merkl reward token (Mezo mainnet): `0x089A6af90041c3ac734cbdeFa84832Aa7fBF67C8` (MezoWrapper, lockDuration 7,257,600 s = 12 weeks). Merkl distributor `0x3ef3d8ba38ebe18db133cec108f4d14ce00dd9ae`. Curve MUSD/2pool LP (Ethereum) `0xB5571E76693ba60110B5811DD650FFefce1C955f`. Morpho Alpha MUSD Core (Ethereum) `0xda4D1A3187Eba9Ecaa137867bD4541f78D51638e`.
- Endpoints: testnet RPC `https://rpc.test.mezo.org` (chain 31611); mainnet RPC `https://rpc-http.mezo.boar.network` (31612); Merkl `https://api.merkl.xyz/v4/opportunities`, `/v4/users/{address}/rewards?chainId=31612`, `/v4/tokens?chainId=31612&symbol=MEZO` (MEZO $0.00297); x402 facilitator `https://facilitator.vativ.io` (supports eip155:31611 MUSD); faucet `https://faucet.test.mezo.org`; testnet app `https://testnet.mezo.org`; bridge `https://portalbridge.com`.

## 15. Verification log
| # | Claim | Status | Evidence |
|---|---|---|---|
| 1 | Core addresses (testnet + mainnet) | VERIFIED | mezo-org/musd deployment JSONs |
| 2 | Borrow parameters: 1% current rate (docs: 1–5%), 0.1% fee, 1,800 min net debt, 200 gas comp, MCR 110%, CCR 150% | VERIFIED | live `eth_call`, Mezo fees page |
| 3 | sMUSD deposit needs approve; deposit succeeds with allowance | VERIFIED | `eth_call` + state override from a real holder |
| 4 | sMUSD withdraw/claimYield work; yield token = MUSD; `claimableYield()` returns 0; not ERC-4626 (no exchange rate — yield is claimed); withdraw is 1:1 and auto-claims pending yield | VERIFIED | `eth_call` (simulated `claimYield` returns the amount, e.g. 10,000 MUSD for the gauge); `totalAssets`/`convertToAssets` revert; 4 mainnet withdraw receipts |
| 5 | Realised APR formula is right for unstaked holders (yield accrues per sMUSD incl. the gauge's 72%) | VERIFIED | formula 4.23%; holder `0xf365…8bc4` (2M sMUSD) claimed 1,632 MUSD over 6.94 days = 4.29% |
| 6 | Staked sMUSD earns emissions instead of fees | VERIFIED | Mezo Savings Vault docs; gauge claims yield (`YieldClaimed`, 10,000 MUSD) |
| 7 | Mezo RPC supports state overrides | VERIFIED | simulation |
| 8 | Merkl user-rewards endpoint (`amount − claimed`) | VERIFIED | real claimers; `0xeaC6…7DAB` has 239.28 unclaimed veMEZO |
| 9 | Merkl LP reward = veMEZO, 12-week lock, claim on Mezo, BTC gas ≈ $0.02 | VERIFIED | Mezo docs, MezoWrapper `lockDuration`, claim txs |
| 9b | Unclaimed Merkl rewards: no published deadline; managers may reallocate them 1 day–1 year after a campaign. v7's "forfeited" came from the April Aerodrome campaign (window closed 30 Apr) and is withdrawn | VERIFIED (corrected) | Merkl docs Campaign Management; Mezo blog "How to Maximize veMEZO", "Introducing MEZO Gauges" |
| 10 | Merkl: 5 live veMEZO campaigns, `nativeApr` field (Curve only), `dailyRewards`, `latestCampaignEnd`, look-alikes in "MUSD" search, veMEZO priced at MEZO spot; `apr` is reward-only (Curve: $32/day × 365 ÷ $244,750 ≈ 4.8%), so adding `nativeApr` does not double-count | VERIFIED | Merkl API, 24 Oct |
| 11 | MEZO price via Merkl tokens endpoint ($0.00297) | VERIFIED | Merkl API |
| 12 | x402 facilitator live on testnet with MUSD; SDK versions OK (`x402` 2.25.0, `@x402/evm` 2.28.0, `python-telegram-bot` 22.8) | VERIFIED | facilitator `/supported`, PyPI, npm |
| 13 | `api.mezo.org` blocked for non-browser clients | VERIFIED | user's curl → 500; server fetches fail |
| 14 | Bridge: Mezo app (Mezo↔Ethereum), Portal (Mezo/Ethereum/Base) | VERIFIED | Mezo docs |
| 15 | Testnet MUSD/BTC pool deep (≈102.6M MUSD / 1,303 BTC) | VERIFIED | `getReserves` |
| 16 | Mezo app desktop-only; shows Mezo pools/vaults APR; Apps directory; no Stability Pool UI | VERIFIED (SP part INFERRED) | visited app, scanned bundle |
| 17 | Morpho Alpha MUSD Core on Ethereum, TVL ≈ $18 | VERIFIED | Morpho GraphQL |
| 18 | Docs PRs: 78/100 merged; outsiders' PRs can stay open; Community Projects additions merged fast | VERIFIED | GitHub API |
| 19 | Gas: charged ≥ 50% of limit | VERIFIED | mezod source + 300 txs |
| 20 | Faucet: 0.05 BTC + 100 MEZO per ~24 h, single-use CAPTCHA; swap works | VERIFIED (by user) | dev wallet balances on-chain |
| 21 | Aerodrome → Aero (22 Oct); Mezo Base gauges renamed, MEZO paused | VERIFIED | mezo-org/documentation PR #353 |
| 22 | Sample trove for the planner is readable live | VERIFIED | `SortedTroves.getFirst()` = `0x593c…5bb5` |
| 23 | Borrow debt = amount + fee + 200; interest on the whole principal; min net debt counts amount + fee | VERIFIED | `BorrowerOperations.sol` (`netDebt += fee`, `increaseTroveDebt(compositeDebt)`) |
| 24 | Testnet sMUSD receives yield: weekly Thu ~00:20 UTC (8, 15, 22 Oct) + 3 extra on 24 Oct; supply 888k; `claimYield` with 0 pending returns 0 (no revert); testnet ≈ 4.5 s/block | VERIFIED | testnet logs + block timestamps, simulation |
| 25 | Mainnet Mezo pools readable; BTC price from PriceFeed ($80,478) | VERIFIED | `token0/1` + `balanceOf`, PriceFeed `fetchPrice()` (`lastGoodPrice()` reverts — fixed 25 Oct after the live deploy showed Mezo pools unavailable) |
| 26 | Curve Merkl listings are nested (Stake DAO + Convex TVL ≈ gauge TVL) | VERIFIED | Merkl API |
| 27 | Vercel deploy can reach Mezo RPC + Merkl | VERIFIED | musd-compass.vercel.app/api/health, 24 Oct 19:38 UTC: mainnet, fallback, testnet, Ethereum, Merkl all OK in 99–213 ms |
| 30 | The Mezo app lists 6 MUSD pools; TVL from token balances matches the app (mUSDC/MUSD-10 $5.34M vs app $5.29M; BTC/MUSD-200 $45.8k vs $45.78k) | VERIFIED | Mezo app Pools page at desktop width + `CLFactory.getPool` + `balanceOf`, 24 Oct |
| 29 | Mainnet RPC fallbacks: Validation Cloud and `rpc-internal.mezo.org` answer chainId 31612 + `eth_getLogs`; viem's default `rpc.mezo.org` failed | VERIFIED | browser checks 24 Oct |
| 28 | x402 client pays MUSD via Permit2 with an EIP-2612 permit for the exact amount; its ERC-20-approval fallback signs `maxUint256` (so the server must not offer it) | VERIFIED | `@x402/evm` 2.28 source; `DEFAULT_ASSETS` lists MUSD for 31611/31612 |
| 31 | Live re-verification 25 Oct 05:40–05:55 UTC: health, 11/11 venues, borrow parameters, sMUSD APR recomputed from raw events (4.008% vs API 4.008%), Stability Pool, Merkl APRs and MEZO price, testnet vault and 4 proof txs, rewards sample, trove sample, x402 402 requirements, all pages, latency | VERIFIED | browser checks against Boar RPC, rpc.test.mezo.org, Merkl API (README "Live re-verification") |
| 32 | Mainnet TroveManager/SortedTroves (the ones BorrowerOperations points to) hold one open trove (`0x593c…5bb5`) while MUSD supply is 29.5M | VERIFIED | `getTroveOwnersCount()` = `getSize()` = 1; `BorrowerOperations.troveManager()` |
| 33 | x402 paid call works end to end on Mezo testnet: facilitator sends the tx and pays gas; Permit2 approval is exactly 0.001 MUSD | VERIFIED | tx `0x0454c620…4997` (Approval 0.001 to Permit2 + Transfer 0.001) |
| 34 | `npm audit`: zod 3 inside @x402 2.28 (GHSA-mrhx-c7xc-m3w5, memory exhaustion on oversized collections); no fix within zod 3 | VERIFIED | npm audit; mitigated by refusing payment headers over 16 KB before x402 parses them |
| 35 | Prices moved since 24 Oct: MEZO $0.00297 → $0.00475; Merkl veMEZO APRs up (Uniswap V4 49.8% → 79.9%, Curve 4.8% → 7.7%) | VERIFIED | Merkl API 25 Oct |
