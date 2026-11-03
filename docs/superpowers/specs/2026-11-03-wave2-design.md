# MUSD Compass Wave 2: plan (draft, stages 1-3)

## Context
Wave 1 judge review (`civ_defi_mezo`, 31 Oct) says integration is already deep and lists what would lift Wave 2:
1. Borrow -> Earn on mainnet with HintHelpers.
2. Monitoring, top-up or repay for the trove it opens, with redemption and Recovery Mode warnings.
3. Show users outside your own wallets using it.
4. A real mainnet x402 price, and who would pay for the premium API and why.
5. WalletConnect or Mezo Passport.
6. Fill team and track fields; fix README video and deck links.

Wave 2 rules (AKINDO overview): "rewards depth"; resubmission must be "explicit about what changed since Wave 1" and show "meaningful new progress". Mezo's stated lenses: extend, don't detour; composability wins; works as expected, every feature testable, no clear security flaws (same reviewer's answer in the Comments tab). Same reviewer to another builder: prove real users with wallet addresses and explorer links, do not mix testnet and mainnet claims, check max borrow at transaction time.

## Research findings (evidence labels)
- VERIFIED (AKINDO page): Wave 2 build Nov 2-15, pool $5,000. The countdown showed "9 Days 15:26" at about 14:05 UTC on 3 Nov and the timeline lists 11/13 11:30 as the deadline. Treat **13 Nov** as the deadline until confirmed in Discord/AKINDO.
- VERIFIED (Compass live API, reads chain): mainnet has **3 open troves**, no Recovery Mode, sample trove ICR ~8,832%. The audience for a trove monitor on mainnet is tiny. My earlier "trove monitor is the return hook" idea was made without this number.
- VERIFIED (other builder's comment, Mezo docs): a trove needs at least 2,000 MUSD debt (1,800 + 200 gas deposit), so small holders cannot borrow.
- VERIFIED (Passport README via npm mirror): built on RainbowKit + wagmi + viem 2; defaults Unisat/OKX/Xverse. Docs show testnet only, no Next.js, mainnet or WalletConnect project-id guidance. Compass's wallet code is hand-rolled (`web/src/lib/wallet.ts`, EIP-6963 + viem), so Passport means adding wagmi/RainbowKit. Mbl, MezoRoute and Janus already ship Passport (prior art).
- VERIFIED (local tasks/todo.md): `[H2b]` Reown project id was never created, so WalletConnect needs the user to make one (free).
- SECONDARY (DIA summary of Mezo docs, third-party mirror): redemption fee 0.75%; redemptions take the lowest collateral ratio at or above 110%; Recovery Mode below 150% system ratio. Matches `redemptionPosition` in `web/src/lib/trove.ts`. Official Mezo redemption page returned 404, so confirm against mezo.org/docs before writing warnings.
- UNKNOWN: sMUSD/MUSD holder counts (explorer API blocked), whether Compass's openTrove path already uses HintHelpers, MUSD peg today, whether Wave 2 criteria weights changed.
- Repo state: local README has 9 tx proof; GitHub README is the older version (last commit "Update README.md" on 26 Oct overwrote it). Must be fixed first.

## Recommended Wave 2 scope (3 to 4 items, narrative: "from where to put MUSD, to keeping it safe, to proof people use it")
1. **Repo and submission hygiene (day 1):** push the local README, fix the video link, add deck link, update the AKINDO entry (team, track, "what changed since Wave 1"). Cheap, directly requested.
2. **Position safety, not just troves:** extend `/my` and `/trove` with a "what to do" layer: redemption position, Recovery Mode and ICR warnings, top-up/repay suggestion sized to a target ICR, max borrow re-checked at transaction time. Works for any address on mainnet (read-only) and testnet (writes). Audience is holders too: the sMUSD staked 1.34% vs unstaked 4.01% gap is the weekly nudge.
3. **Borrow -> Earn on mainnet (user decision: full mainnet).** Guardrails, because this reverses the Wave 1 "no mainnet writes" rule:
   - Extend the `sendSafely` allowlist to mainnet `BorrowerOperations.openTrove`, exact-amount MUSD approve to the mainnet sMUSD vault, and `deposit` only. Nothing else (no adjust, close, redeem) except top-up/repay if built.
   - Use HintHelpers for hints; re-read price and max borrow at send time; refuse below target ICR 200%; simulate, gas x1.2, receipt, as today.
   - Mainnet is off until the user switches it on (env flag + explicit on-screen chain and amount confirmation); testnet stays the default so judges can try it free.
   - Build and test with mainnet `simulateContract` (viem stateOverride) so no funds are needed until the single real run; the user signs the one real transaction themselves from a dedicated wallet, public addresses only.
   - Minimum debt is 2,000 MUSD (about $4k+ BTC collateral): dependency on the user having that BTC on Mezo mainnet. If not, fall back to testnet-only plus read-only mainnet monitoring.
   - Security review (security-audit skill) before enabling; update README/SPEC/docs wording from "no mainnet writes" to "capped, opt-in mainnet".
4. **Distribution proof:** 3 to 5 real outside wallets with explorer links on testnet, plus bot and widget usage. Needs the user to recruit (user said they will).
5. **x402 pricing story:** name the buyer (bots/widgets/agents pulling yields), set a mainnet price in the doc, state it is testnet-priced today. No new payment code unless mainnet x402 is feasible.
6. **Wallet (user decision): WalletConnect only.** Add it to `WalletModal.tsx` as the currently disabled row; needs a free Reown project id from the user (`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, old task H2b). Passport stays on the Wave 3 roadmap.

## Critical files (existing, reuse)
- `web/src/lib/trove.ts` (readTrove, safeExtraBorrow, redemptionPosition), `web/src/components/TrovePanel.tsx`, `MyPanel.tsx`
- `web/src/lib/sendSafely.ts` (allowlist, simulate, exact approvals), `web/src/lib/wallet.ts`, `WalletModal.tsx`, `VaultPanel.tsx`
- `web/src/lib/x402.ts`, `web/src/app/api/premium/yields/route.ts`
- `README.md`, `docs/evidence.md`, `docs/submission/*`, `tasks/todo.md`

## Skills per stage
brainstorming -> design doc -> writing-plans -> TDD build (humanizer on copy, design-taste-frontend for UI) -> playwright/axe tests + systematic-debugging -> review + security-audit -> verification-before-completion + ship.

## Verification (end of build)
`npm run lint && npm run typecheck && npm test && npm run build`, Playwright e2e at 360px with axe, bot pytest, live `/api/health`, browser check of /my, /trove, /vault on the deployed URL, then compare GitHub README with the local file.

## Decisions made
1. Mainnet: full mainnet Borrow -> Earn (guardrails above). 2. Wallet: WalletConnect only.

## Still needed from the user
- Confirm they hold (or can get) about 0.05+ BTC on Mezo mainnet for the 2,000 MUSD minimum trove, and are willing to use a dedicated wallet.
- Create the free Reown project id.
- Confirm the Wave 2 deadline in Discord/AKINDO (13 vs 15 Nov).
- Recruit 3 to 5 outside testers.

## Next step after approval
Stage 3: write the task breakdown (superpowers:writing-plans) with order, tests and time boxes against the 13 Nov deadline, README/AKINDO fixes first.
