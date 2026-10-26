# Changelog

## 0.1.0 — Wave 1 (25 Oct 2026)
- Restyle (26 Oct): white (light) by default with a purple accent and pastel tiles, dark theme behind a saved toggle, Plus Jakarta Sans, phone tab bar; home adds the problem cards (stacked, spread on tap), how it works, where the numbers come from, other channels, FAQ and a full footer. Same data and calculator.
- Security review: no framing outside `/embed`, CSP and security headers, only https links from Merkl, `/api/health` hides upstream errors and is rate-limited, timing-safe bot key, webhook ignores malformed updates.
- Fixed: CI typecheck (route types generated first); home page no longer prefetches other pages' code; CSS inlined.
- Project scaffold: Next.js web app, Python bot webhook skeleton, CI.
- Live sources: sMUSD realised 14-day APR, Stability Pool, six Mezo MUSD pools, Mezo-paid Merkl venues (Uniswap V4, Curve with nested routes), Morpho, live borrow parameters, live Ethereum round-trip cost.
- `GET /api/yields`: two-number carry (cash ranks, locked veMEZO beside it), break-even vs sMUSD, validated query, CORS, rate limit.
- Home page: shelf-label venue ranking, calculator with deep links, size-only list, PWA manifest, light/dark, WCAG AA checks in e2e.
- Vault page (Mezo testnet): connect any injected wallet, auto add/switch to chain 31611, look up any address or a sample, exact-amount approve → deposit, claim yield, withdraw — each simulated first and sent with gas = estimate × 1.2 through an allowlist (testnet MUSD and sMUSD only).
- `/api/vault/{address}`: testnet balances, allowance, pending yield (simulated claimYield), last distribution.
- x402 premium API: `GET /api/premium/yields` for 0.001 test MUSD on Mezo testnet (exact scheme, Permit2 with an exact-amount EIP-2612 permit; facilitator pays gas) — carry for every mode × holding period, plus trove and rewards for `&address=`; "Pay & fetch" button on `/developers` checks the request before signing; oversized payment headers refused before parsing.
- Incentive efficiency board: `/incentives` — each Mezo-paid campaign's USD per day against its liquidity (per $1k per day), nested Curve listings not added; `incentiveUsdPerDay` in `/api/yields`.
- Trove planner: `/trove` and `GET /api/trove/{address|sample}` — collateral, debt, collateral ratio, the trove's own rate, redemption-queue position (troves redeemed first, from a 5-minute cached scan), recovery-mode warning, and extra MUSD you can borrow while staying ≥ 200% (fee counted); "Use in calculator" opens existing-trove mode at that rate; bot `/trove`.
- Rewards reminder: `/rewards` and `GET /api/rewards/{address}` — unclaimed veMEZO from Mezo's Merkl campaigns (amount − claimed), value at MEZO spot, not-yet-claimable amount, campaign end, the reallocation warning, the gas note and the reward path; sample button; bot `/rewards <address>`; linked from the home footer and `/developers`.
- Fixed: small USD values keep cents ($0.71, not $1).
- Judge pages: `/get-test-musd` (add the network, faucet, swap, then deposit) and `/developers` (API parameters and fields, curl examples, widget tag, bot); nav "API" opens `/developers`. README "Judge check in 60 seconds". `scripts/latency.sh` (p50/p95 of a cached endpoint).
- Fixed: the home page hydrated with an error (server printed "$77.0K", browsers "$77K"), so React re-rendered it on load; the Archivo font is now preloaded.
- Embeddable widget: `<script src="https://musd-compass.vercel.app/embed.js" data-amount="2000" async></script>` adds an iframe with the top 3 venues by cash carry (🔒 beside), the data and holding labels, and a link to the full table.
- Telegram bot: `/yield [amount]`, `/carry <amount> [borrow]`, `/vault <address>`, `/help` — all numbers from the Compass API (sent with the `x-compass-bot` key), cash carry first with 🔒 beside it, break-even for Ethereum venues, API notices shown as-is, "Mainnet data · assumes 90-day hold" / "Testnet" labels, deep links to the web table and the vault deposit, per-chat rate limit, friendly "data unavailable" replies, `--poll` mode for local runs.
