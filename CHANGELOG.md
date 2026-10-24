# Changelog

## Unreleased (Wave 1)
- Project scaffold: Next.js web app, Python bot webhook skeleton, CI.
- Live sources: sMUSD realised 14-day APR, Stability Pool, six Mezo MUSD pools, Mezo-paid Merkl venues (Uniswap V4, Curve with nested routes), Morpho, live borrow parameters, live Ethereum round-trip cost.
- `GET /api/yields`: two-number carry (cash ranks, locked veMEZO beside it), break-even vs sMUSD, validated query, CORS, rate limit.
- Home page: shelf-label venue ranking, calculator with deep links, size-only list, PWA manifest, light/dark, WCAG AA checks in e2e.
- Vault page (Mezo testnet): connect any injected wallet, auto add/switch to chain 31611, look up any address or a sample, exact-amount approve → deposit, claim yield, withdraw — each simulated first and sent with gas = estimate × 1.2 through an allowlist (testnet MUSD and sMUSD only).
- `/api/vault/{address}`: testnet balances, allowance, pending yield (simulated claimYield), last distribution.
- Telegram bot: `/yield [amount]`, `/carry <amount> [borrow]`, `/vault <address>`, `/help` — all numbers from the Compass API (sent with the `x-compass-bot` key), cash carry first with 🔒 beside it, break-even for Ethereum venues, API notices shown as-is, "Mainnet data · assumes 90-day hold" / "Testnet" labels, deep links to the web table and the vault deposit, per-chat rate limit, friendly "data unavailable" replies, `--poll` mode for local runs.
