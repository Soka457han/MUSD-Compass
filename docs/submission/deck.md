# Deck — 5 slides (source text)

> Slide text for the deck; the deck itself is built from this once you approve the wording. Claims only what shipped.

## 1. Problem — "Where should my MUSD be right now?"
- MUSD can earn in the Savings Vault, six Mezo pools, the Stability Pool and Mezo-paid pools on Ethereum.
- Each shows a different number; some pay cash, some pay veMEZO locked 12 weeks, Ethereum costs a bridge round trip.
- The Mezo app is desktop-only. Unclaimed veMEZO can be reallocated.

## 2. Product — net carry, cash first
- Every MUSD venue ranked by **cash carry after costs**; 🔒 locked veMEZO beside it, never inside it.
- Holder or borrower (real trove costs), 30 / 90 / 365-day hold, break-even vs the Savings Vault.
- Every number states its assumption and source; a down source says "unavailable".
- Unclaimed veMEZO check and a trove planner (safe extra borrow at ≥ 200%, redemption-queue position).
- Phone web app · Telegram bot · one-tag widget · free JSON API.

## 3. Mezo integration
- Reads (mainnet): sMUSD yield events → realised 14-day APR · Stability Pool · 6 Mezo pools · PriceFeed · live borrow parameters · TroveManager + SortedTroves (planner).
- Writes (testnet): sMUSD exact approve → deposit · claimYield · withdraw.
- MUSD as payment: x402 premium API, 0.001 test MUSD per call.
- Mezo incentives: Merkl veMEZO campaigns + per-user unclaimed rewards.
- Sends users into Mezo's own products: Savings Vault, Mezo app pools, Merkl claim.

## 4. Demo and proof
- Live: musd-compass.vercel.app · @musd_compass_bot · /developers.
- Testnet proof: approve 100 MUSD (exact) · deposit 100 · withdraw 10 — explorer links in the README.
- Safety: allowlisted contracts, simulate before sign, gas × 1.2, no custody, no keys, no mainnet writes.
- Quality: 63 unit + 20 e2e + 16 bot tests, axe on every page, CI.

## 5. Roadmap (Wave 2+)
- WalletConnect for phone wallets.
- Bot alerts: a better venue, or rewards waiting to be claimed.
- Mainnet Savings Vault deposits after review.
