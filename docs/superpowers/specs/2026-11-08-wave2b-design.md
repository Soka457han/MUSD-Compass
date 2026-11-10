# MUSD Compass Wave 2b: trove care, outside-user proof, pricing, then depth

Date: 8 Nov 2026. Wave 2 closes 15 Nov 2026.

## Why

The Wave 1 review asked for three things Compass still lacks: proof that people outside the team use it, care for a trove after Borrow → Earn opens it, and a real answer to "who pays for x402". Two other projects lost points for numbers that disagreed with each other and for slow pages, so every number Compass shows must say how old it is and pages must stay fast.

## Order (the user's)

1. (2) Trove care with bot `/watch` alerts.
2. (1) Outside-user proof and a public `/stats` page.
3. (3) x402 pricing and who pays.
4. (4) More venues, (5) the MUSD peg / redemption-floor line, (6) freshness on every number and a speed check. Each of (4) and (5) starts with on-chain verification; nothing unverified is shown.

## Goals

- **Trove care.** `/api/trove` returns the same advice the web vault shows (ratio vs liquidation, redemption queue, Recovery Mode, top-up and repay amounts). The bot's `/trove` shows it. `/watch <address>` subscribes a Telegram chat; a check every 15 minutes (the user's choice) sends a message only when the advice changes. `/unwatch` and `/watching` manage it.
- **Proof.** A public `/stats` page with aggregate counts only: API calls per route (total and last 7 days), distinct bot users, x402 payments and distinct payers per network, and websites that embed the widget. No personal address is ever stored or shown. The team's own two wallets are counted separately and labelled as ours. The page says when counting started.
- **Pricing.** `/developers` gets who pays (bot and agent developers, treasury dashboards), the price per call and per 1,000 calls on each network, what Compass pays to serve 1,000 calls, and what doing it yourself costs.
- **Depth (4–6).** Each new venue, the peg line and the floor are verified on chain first and recorded in `docs/evidence.md`. Every venue card shows the time of its data. A speed check runs against the live pages.

## Non-goals

- Bringing in the outside users. That is outreach the user does; Compass gives them a page to point at and draft posts.
- Mainnet writes. `NEXT_PUBLIC_MAINNET_WRITES` stays off.
- Alerts faster than 15 minutes, email or WhatsApp alerts.

## Anti-goals

- A stat that counts our own traffic as outside use (cron and warm-up calls, our two wallets).
- Storing a chat id or an address in a form someone could read back from `/stats`.
- An alert that repeats every 15 minutes while nothing changed.
- A venue, rate or price shown without a verified source.

## Decisions (calls made by Claude, stated for the user to check)

- **Storage:** Upstash Redis from the Vercel Marketplace (free tier), used through its REST API with `fetch`, so no new npm dependency. Only the web project talks to it; the bot goes through the web API with its existing `BOT_API_KEY` header. If Redis is not configured (local runs, CI, fixtures), every store call is a no-op and `/stats` says counting is not set up.
- **Watch storage:** chat ids and watched addresses are stored, because alerts need them; they are never shown. At most 3 addresses per chat, 500 watches in total.
- **Schedule:** a GitHub Actions workflow calls `/api/watch/run` every 15 minutes with a `CRON_SECRET` bearer token. Vercel Hobby cron only runs daily.
- **Alerts are sent by the web project** with `TELEGRAM_BOT_TOKEN`, because the advice logic (`troveAdvice` in `web/src/lib/safety.ts`) lives there.
- **Bot users** are counted as a HyperLogLog of `sha256(BOT_API_KEY + chat_id)` sent by the bot in an `x-compass-user` header, so the raw id never reaches the web project.
- **x402 payers** come from the settlement header (`PAYMENT-RESPONSE`, field `payer`) after a paid call, counted in a HyperLogLog per network, so addresses are not kept.
- **Own traffic:** requests with `?warm=1` (the Vercel cron and the GitHub warm job) are not counted. The two team wallets `0xfe21B2782B35BE770DD4a7b05f81cE43790D676C` and `0xC20F87B85A58a0Bc1E0eE851D0bBAaDFFf9e9C4C` are counted as "ours".

## What the user does

1. In Vercel, web project: add Upstash Redis from the Marketplace (Storage → Create → Upstash), connected to `musd-compass`.
2. In Vercel, web project env: `TELEGRAM_BOT_TOKEN` (the bot's token) and `CRON_SECRET` (any long random string). In GitHub, repo secret `CRON_SECRET` with the same value. Claude never types tokens.
3. Copy the new workflow files into `.github/workflows` (tools cannot write there) and push.
4. Outreach for real users, with the draft posts Claude writes.

## Left to the builder

Message wording within the copy rules, layout of `/stats` in the house style, and the research method for (4) and (5).
