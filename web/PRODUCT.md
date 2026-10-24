# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- MUSD holders and borrowers on Mezo, usually on a phone (the Mezo app is desktop-only), asking "where should my MUSD be right now, after costs?"
- Mezo Buildathon judges and the Mezo team, who open one link, test every feature without setup, and judge Mezo integration, viability, technical quality, UX and materials.
- Developers and agents who read the same numbers through the open JSON API.

## Product Purpose
MUSD Compass ranks every place Mezo MUSD can earn (Mezo Savings Vault, Mezo pools, Stability Pool, Mezo-paid Ethereum pools) by **net carry after costs**, and lets the user deposit into the Mezo Savings Vault on testnet in a few taps. Success: a visitor understands within one screen where MUSD earns most in cash, and can act.

## Positioning
Cash first: liquid yield ranks; locked veMEZO rewards (12-week lock, priced at MEZO spot) are always shown apart and never counted as cash. Every number states its assumption (holding period, borrow rate, costs). Runs where the Mezo app does not: phones, Telegram, any website, agents.

## Operating Context
Phone browser at 360 px and up, often one-handed, often between other apps; Telegram bot links into the same pages. Judges review on desktop and phone. Data is Mezo mainnet + Ethereum; wallet actions run on Mezo testnet and say so.

## Capabilities and Constraints
- Wallet-free reading; any EVM wallet for testnet actions; exact-amount approvals only; no custody.
- Two numbers everywhere: cash carry and total carry (🔒 locked). Holding period 30 / 90 / 365 days, default 90. Borrow rate 1–5 %, default the live rate.
- English only in Wave 1.

## Brand Commitments
Name "MUSD Compass". No logo or palette is fixed (delegated to design). Do not copy Mezo's logo or official brand look; Compass is an independent community tool.

## Evidence on Hand
Live on-chain and Merkl data only (recorded samples in `tests/fixtures/`). No users, testimonials, partners or endorsements exist — never invent them.

## Product Principles
1. Cash before promises: rank by what can be spent; show locked value beside it, never inside it.
2. Every number carries its assumption and its source.
3. Honest gaps: a source that is down shows as unavailable, not as a guess.
4. Mainnet data, testnet actions — always labelled.
5. One screen, one answer: the first view answers the question without scrolling.

## Accessibility & Inclusion
WCAG 2.2 AA; keyboard and screen reader; works at 360 px with no horizontal scroll; respects reduced motion.
