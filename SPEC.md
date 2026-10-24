# Spec: MUSD Compass (Wave 1)

Source of truth for *what* and *why*: `docs/design.md` (v8). This spec says *how we build it and how we know it is done*. If the two disagree, fix the design first, then this spec.

## Assumptions (correct these before Task 1)
1. Code is written and tested in Claude's cloud workspace, delivered into `F:\snipping\musd-compass\`, and the user pushes it to a new public GitHub repo. Claude never holds GitHub, Vercel, Telegram or wallet credentials. The user's VS Code / GitHub Desktop is used only to view, run locally and push — never to edit the same files in parallel.
2. Package manager: **npm** (nothing extra to install on the user's PC). Node 22 LTS.
3. Hosting: all on Vercel's free tier — project 1 = `web/` (Next.js), project 2 = `bot/` (Python function receiving Telegram **webhooks**, so it never sleeps and needs no always-on server or card). Railway/Render workers cost money after a small trial (Railway: one-time $5, then $1/month credit; Render: no free worker, $7/month), so they are only the fallback. Default domain `musd-compass.vercel.app`.
4. English UI only. Wave 1 deadline: **26 Oct 2026 15:00 UTC (21:00 Dhaka)**; ≈48 h from spec time, ≈25–30 working hours.
5. One spec with a module map below, not one spec per module: the modules share one API contract, and the timebox doesn't allow seven review gates.

## Objective
A phone-first web app, open JSON API, embeddable widget and Telegram bot that rank every place to earn with Mezo MUSD by **net carry**: cash first, total with locked veMEZO 🔒 beside it. Users can deposit into the Mezo **Savings Vault** on testnet in a few taps.
Users: MUSD holders, borrowers, Ethereum MUSD LPs, agents/developers, the Mezo team (design §2).
Success = a judge can open one link on a phone, understand where MUSD earns most after costs, and complete a real testnet deposit, withdraw and claim. They can also reach every other feature through "Try a sample", with no setup.

## Module map (stable ids; arrows point to dependencies)
| Module id | Responsibility | Depends on | Tier |
|---|---|---|---|
| `chain` | Chain configs (viem `mezo`, `mezoTestnet`, `mainnet`), addresses, ABIs, RPC clients with fallback | — | MUST |
| `sources` | One adapter per data source: sMUSD, Stability Pool, Mezo pools, Merkl, Morpho, borrow params, Ethereum gas/ETH price | `chain` | MUST |
| `carry` | Pure math: costs, cash/total carry, dilution, break-even scan, identity guard | — | MUST |
| `yields-api` | `GET /api/yields` = sources + carry, cached 5 min, validated query | `sources`, `carry` | MUST |
| `web-ui` | Venue table + calculator page, `/embed` widget, judge pages | `yields-api` | MUST |
| `vault` | Wallet connect, `/api/vault/[address]`, deposit / withdraw / claimYield on testnet | `chain` | MUST |
| `bot` | Python Telegram bot calling the API only | `yields-api`, `vault` | MUST |
| `rewards` | `/api/rewards/[address]`, page, `/rewards` | `sources` | SHOULD 6 |
| `trove` | `/api/trove/[address]`, planner page, fills calculator | `chain`, `carry` | SHOULD 7 |
| `premium` | x402 `/api/premium/yields`, Pay & fetch button | `yields-api`, `rewards`, `trove` | SHOULD 8 |
| `efficiency` | Incentive Efficiency board | `sources` | SHOULD 9 |

Build order: `chain` → `carry`, `sources` → `yields-api` → `web-ui`, `vault` → `bot` → SHOULDs, cut from the bottom (9, 8, 7, 6).

## Tech Stack (versions checked 24 Oct; pin exact versions in package-lock)
- Next.js 16.4 (App Router, TypeScript, Tailwind from create-next-app), React 19
- viem 2.57 (has `mezo` 31612 and `mezoTestnet` 31611 chains), wagmi 3.7 + @tanstack/react-query 5. Connectors: injected; WalletConnect only when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set
- @x402/next, @x402/evm, @x402/fetch 2.28. `@x402/evm` already lists Mezo MUSD as the default asset for `eip155:31611` and `eip155:31612` (Permit2 + EIP-2612), so `price: "$0.001"` settles in MUSD
- Vitest 5 (unit), @playwright/test pinned to **1.56.0** (matches the preinstalled browser) + @axe-core/playwright 4.14 (e2e and accessibility)
- Bot: Python 3.13 on Vercel (file-based function, `BaseHTTPRequestHandler`), httpx, pytest. No bot framework: one update per request, reply in the response body (Telegram "making requests when getting updates")
- Measurement only (not dependencies): Lighthouse CLI via `npx lighthouse`, `scripts/latency.sh` (curl × 20 → p95)
- No database. No own smart contract.

## Commands
```
# web
cd web && npm ci
npm run dev                 # http://localhost:3000
npm run lint                # eslint
npm run typecheck           # tsc --noEmit
npm test                    # vitest run
npm run e2e                 # playwright test (starts the app, runs smoke + axe at 360px)
npm run build               # next build

# bot
cd bot && python -m pip install -r requirements.txt
python -m pytest -q
COMPASS_API_URL=http://localhost:3000 TELEGRAM_BOT_TOKEN=… python bot.py
```
CI (`.github/workflows/ci.yml`): lint → typecheck → test → build → e2e for web; pytest for bot. Runs on every push.

## Project Structure
```
musd-compass/
  SPEC.md  README.md  LICENSE (MIT)  CHANGELOG.md
  docs/design.md                 design v8 (what/why)
  tasks/plan.md  tasks/todo.md   plan + checklist
  web/
    src/app/page.tsx             venue table + calculator (home)
    src/app/vault/page.tsx       Savings Vault actions (testnet)
    src/app/embed/page.tsx       widget (also /embed.js loader in public/)
    src/app/get-test-musd/page.tsx
    src/app/developers/page.tsx  API docs (+ Pay & fetch, SHOULD)
    src/app/rewards/ trove/ efficiency/   SHOULD pages
    src/app/api/yields/route.ts
    src/app/api/vault/[address]/route.ts
    src/app/api/{rewards,trove}/[address]/route.ts   SHOULD
    src/app/api/premium/yields/route.ts              SHOULD
    src/lib/chain/{chains,addresses,abis,clients}.ts
    src/lib/sources/{smusd,stabilityPool,mezoPools,merkl,morpho,borrowParams,ethCosts}.ts
    src/lib/carry/{carry,breakEven,identity}.ts
    src/lib/cache.ts             wraps Next's shared data cache (`unstable_cache` or `"use cache"` + `cacheLife`, whichever Next 16.4 recommends; confirmed in T1), revalidate 300 s, shared across Vercel instances
    src/components/…
    tests/unit/…  tests/fixtures/… (live data recorded 24–25 Oct)
    e2e/…
  bot/
    api/telegram.py  (Vercel webhook entry)  bot.py (commands; `python bot.py --poll` for local testing)  api_client.py  fmt.py  requirements.txt  vercel.json  tests/
  .github/workflows/ci.yml
```

## Code Style
TypeScript strict. Pure math lives in `lib/carry` with no I/O. Adapters return typed results and never throw past the route: a failed source becomes a venue with `status: "unavailable"`. On-chain amounts stay `bigint` in wei; percentages are `number`; convert at one edge (`formatUnits`).

```ts
// web/src/lib/carry/carry.ts
export type CarryInput = {
  amount: number;            // MUSD put to work
  days: 30 | 90 | 365;
  mode: "holder" | "borrower";
  trove: "new" | "existing";
  ratePct: number;           // borrow rate, 1–5
  feePct: number;            // live from BorrowerOperations (0.1)
  gasCompensation: number;   // live (200)
};

export function borrowCostPct(i: CarryInput): number {
  if (i.mode === "holder") return 0;
  const fee = i.amount * (i.feePct / 100);
  const debt = i.amount + fee + (i.trove === "new" ? i.gasCompensation : 0);
  return i.ratePct * (debt / i.amount) + i.feePct * (365 / i.days);
}
```
Naming: `camelCase` functions, `PascalCase` components and types, files `camelCase.ts`. Python: PEP 8, type hints, `ruff format`. Comments only for the *why*.

## Testing Strategy
- **Unit (Vitest), `web/tests/unit`**: every `lib/carry` function, with the design's worked numbers as fixed cases: 2.72% borrower carry, debt 2,202, 1.10% interest, fee 0.41 / 1.22 / 0.10 %/yr, dilution 47.26%, Uniswap cap ≈383k, minimum 1,798.21, identity guard rejecting mUSD / smUSD / Pharos look-alikes. Adapters are tested against recorded fixtures (Merkl JSON, sMUSD logs → 4.01% over 14 days, 4.23% over 7).
- **Route contract tests**: `/api/yields` with mocked adapters: shape, sorting (cash desc, "—" rows last), query validation (bad amount → 400), unavailable source → venue still listed.
- **E2E (Playwright, 360×740)**: home renders a sorted table with no wallet; calculator changes numbers; `/vault` shows the testnet banner; `/embed` renders; axe reports **0 serious/critical** on `/`, `/vault`, `/embed`, `/get-test-musd`.
- **Bot (pytest)**: command parsing and message formatting with a mocked API; error text when the API is down.
- **Manual on testnet (recorded in README)**: approve → deposit → claimYield → withdraw from the dev wallet; tx hashes listed.
- Coverage target: `lib/` ≥ 90% lines; no coverage target for UI.

## Boundaries
- **Always:** run lint + typecheck + tests before each commit; simulate every write; exact-amount approvals; gas limit = estimate × 1.2; match MUSD by address; label mainnet data vs testnet actions; keep `docs/design.md` in sync when scope changes; update CHANGELOG.
- **Ask first:** adding any dependency not listed above; changing the API response shape after Checkpoint A; any mainnet transaction; storing any user data; changing hosting; cutting a MUST.
- **Never:** commit secrets or `.env*` (only `.env.example`); ask for or handle seed phrases or private keys; use `isTrustedForwarder` / meta-transactions; unlimited approvals (incl. x402: advertise only `eip2612GasSponsoring`, which permits the exact amount; never the ERC-20 approval extension, which signs `maxUint256`); call `api.mezo.org` from the server; present veMEZO as cash; invent a claim deadline; deploy our own contract in Wave 1.

## Environment variables (`.env.example`)
web: `MEZO_MAINNET_RPC` (default `https://rpc-http.mezo.boar.network`), `MEZO_MAINNET_RPC_FALLBACK` (default `https://mainnet.mezo.public.validationcloud.io`; `https://rpc-internal.mezo.org` as a second option; both checked 24 Oct. Do not use viem's default `rpc.mezo.org`, which failed the check), `MEZO_TESTNET_RPC` (default `https://rpc.test.mezo.org`), `ETHEREUM_RPC` (default `https://ethereum-rpc.publicnode.com`), `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (optional), `X402_PAY_TO` (public payee address), `X402_FACILITATOR_URL` (default `https://facilitator.vativ.io`).
web + bot: `BOT_API_KEY` (shared secret; the bot sends it as `x-compass-bot`, and the API then skips its per-IP limit because all bot traffic comes from one IP).
bot: no bot token at runtime (replies go back inside the webhook response; the token is used once, by you, in the setWebhook link); `TELEGRAM_WEBHOOK_SECRET` (random; Telegram sends it in `X-Telegram-Bot-Api-Secret-Token`, and the function rejects any update without it), `COMPASS_API_URL`, `COMPASS_WEB_URL`.

## Success Criteria (Wave 1 is done when all MUST lines are true)
MUST
1. `GET /api/yields` returns 11 venues (sMUSD, Stability Pool, 6 Mezo MUSD pools, Uniswap V4, Curve, Morpho) with the §7 fields; p95 < 1.5 s when cached; every venue has `source` and `updatedAt`.
2. The sMUSD realised APR from live logs is within ±0.3 pt of an independent recomputation run on the same day.
3. The default view (holder, 2,000 MUSD, 90 days) is sorted by cash carry. Rows without an APR show "—" and sort last. Every carry figure shows its holding period.
4. On a 360 px phone with no wallet, the home page loads and shows numbers in < 3 s on 4G (Lighthouse mobile), with no horizontal scroll.
5. On Mezo testnet from the dev wallet: exact approve → deposit → claimYield → withdraw all succeed. `claimYield` may pay 0 before the next distribution (observed weekly on Thu ~00:20 UTC plus occasional extras; not guaranteed): it returns 0 without reverting, and the UI says so, showing only the last distribution time. Each is simulated first, sent with gas = estimate × 1.2, and linked in the README.
6. The bot answers `/yield`, `/carry 2000 borrow` and `/vault <address>` in < 5 s on the deployed host, using the same numbers as the web page.
7. `/embed` works from a one-line script tag on a plain HTML page.
8. CI is green; axe shows 0 serious/critical issues on the 4 pages.
9. Judge kit: README "judge check in 60 seconds", the Get-test-MUSD page, "Try a sample" for every address feature, 5-slide deck, 2-minute video, AKINDO form submitted with both tracks named.
10. Verification log #27 is closed: the deployed Vercel API reads the Mezo RPC and Merkl.
SHOULD (each done = acceptance criteria in tasks/todo.md met)
11. Rewards reminder; 12. Trove planner; 13. x402 paid call recorded on testnet; 14. Efficiency board.

## Open Questions
1. Assumption 1: code is built here and delivered to your folder, and you push it to GitHub. The alternative is building on your PC with Claude Code. Which do you want?
2. ~~Bot host~~ — decided: Vercel webhook function (free, never sleeps). Fallback if the Checkpoint 0 bot spike fails: Railway trial.
