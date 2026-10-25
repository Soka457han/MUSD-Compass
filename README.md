# MUSD Compass

Where does Mezo MUSD earn the most **after costs**? MUSD Compass ranks every venue — Mezo and Ethereum — by net carry (cash first, locked veMEZO 🔒 beside it) and lets you deposit into the Mezo Savings Vault on testnet in a few taps. Phone-first web app, open API, embeddable widget, Telegram bot.

## Judge check in 60 seconds
Everything works on a phone, without a wallet.

1. **Ranking** — open [musd-compass.vercel.app](https://musd-compass.vercel.app). The top label is where 2,000 MUSD earns the most **cash** per year after costs; locked veMEZO 🔒 sits beside it and never counts as cash.
2. **Calculator** — change the amount, switch to *Borrower* or *365 days*: labels re-rank and every number states its assumption. Ethereum venues show the amount where they beat the Savings Vault.
3. **Testnet vault** — [`/vault`](https://musd-compass.vercel.app/vault) → *Try a sample* shows the dev wallet's real position (90 sMUSD). To deposit yourself: [get test MUSD in 3 steps](https://musd-compass.vercel.app/get-test-musd), then *Connect wallet*.
4. **Telegram** — [@musd_compass_bot](https://t.me/musd_compass_bot): `/yield`, `/carry 2000 borrow`, `/vault 0xfe21B2782B35BE770DD4a7b05f81cE43790D676C`, `/rewards 0xeaC6A75e19beB1283352d24c0311De865a867DAB`, `/trove sample`.
5. **Rewards and trove planner** — [`/rewards`](https://musd-compass.vercel.app/rewards) and [`/trove`](https://musd-compass.vercel.app/trove) → *Try a sample*: unclaimed veMEZO for a real address; a live mainnet trove's ratio, rate, redemption-queue position and safe extra borrow.
6. **API and widget** — [`/developers`](https://musd-compass.vercel.app/developers): free JSON API with curl examples, a one-tag widget ([preview](https://musd-compass.vercel.app/embed)), and a paid x402 endpoint you can try with *Pay 0.001 MUSD & fetch* (testnet MUSD).

> Work in progress for the Mezo Buildathon (Wave 1). Spec: [`SPEC.md`](SPEC.md) · design: [`docs/design.md`](docs/design.md) · plan: [`tasks/plan.md`](tasks/plan.md)

## Testnet proof (Mezo testnet, chain 31611)
Made through [`/vault`](https://musd-compass.vercel.app/vault) from the public dev wallet [`0xfe21…676C`](https://explorer.test.mezo.org/address/0xfe21B2782B35BE770DD4a7b05f81cE43790D676C) on 24 Oct 2026:

| Step | Amount | Transaction |
|---|---|---|
| Approve (exact amount, not unlimited) | 100 MUSD | [`0xa5ec9c45…570f`](https://explorer.test.mezo.org/tx/0xa5ec9c450e27dfac27fb18f2ad91d2cdd5e2a1c782472108be93126766b1570f) |
| Deposit into the Savings Vault | 100 MUSD → 100 sMUSD | [`0x1f4ddeb6…8f3c`](https://explorer.test.mezo.org/tx/0x1f4ddeb61396464e32ee63806a35a3e5cf8cb9218613880e24a5324293458f3c) |
| Withdraw (also pays any pending yield) | 10 MUSD | [`0x3045fba8…77cf`](https://explorer.test.mezo.org/tx/0x3045fba85e8551ca6a465567911f96b68ded7a336f99640c51b3104525f777cf) |

After these the wallet holds 90 sMUSD and 67.31 MUSD, the vault allowance is back to 0, and [`/api/vault/0xfe21…676C`](https://musd-compass.vercel.app/api/vault/0xfe21B2782B35BE770DD4a7b05f81cE43790D676C) shows the same. A claim is added after the next yield distribution, so it pays a real amount.

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
