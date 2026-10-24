# Implementation Plan: MUSD Compass (Wave 1)

## Overview
We build the design v8 MUSTs as vertical slices, riskiest first: deploy reachability, live data, the carry math, then the wallet write. Each slice ends working and deployable. SHOULDs come after the MUST checkpoint and are cut from the bottom. Spec: `SPEC.md`. Checklist: `tasks/todo.md`.

## Architecture Decisions
- **One API, many surfaces.** Web, widget, bot and x402 all call `/api/yields` (or its siblings). No business logic in the bot or UI, so numbers never disagree.
- **Adapters never throw past the route.** A dead source becomes `status: "unavailable"` on its venue, so a judge never sees an empty page.
- **Cache, don't hammer.** sMUSD logs (≈16 sequential 10k-block windows) and Merkl are computed into Next's shared data cache (`unstable_cache`, revalidate 300 s), not in-memory, so a fresh Vercel instance never rescans on a user request. Boar RPC rate-limits parallel bursts.
- **Pure carry math** in `lib/carry`, tested against the design's worked numbers before any UI uses it.
- **Writes only on testnet, only to testnet MUSD (approve) and sMUSD**, through one `sendSafely()` helper: allowlist check → simulate → estimate × 1.2 → send → poll receipt. Every button uses it.
- **No database.** Every address feature takes the address per request.
- **x402 via `withX402`** on the API route, so settlement happens only after a successful response. `@x402/evm` already maps Mezo MUSD, so no custom asset code is needed.

## Dependency graph
```
chain ──► sources ──► yields-api ──► web-ui (table+calculator, embed, judge pages)
  │          ▲            │   └────► bot
  │        carry ─────────┘
  └──► vault (wallet, /api/vault, writes) ──► bot /vault
SHOULD: sources ► rewards ;  chain+carry ► trove ;  yields-api+rewards+trove ► premium ;  sources ► efficiency
```

## Schedule (UTC / Dhaka). Human steps are marked [H]
Wall clock ≈ 46 h (Sat 15:00 → Mon 13:00 UTC); your hands-on time ≈ 8 h (H steps, pushes, reviews). Claude builds between your steps. Code is pushed by you at every checkpoint ([H-push]: copy from `F:\snipping\musd-compass` → GitHub; Vercel redeploys itself).

| Block | When (UTC → Dhaka) | Claude | You [H] | Checkpoint |
|---|---|---|---|---|
| A. Foundation + de-risk | Sat 24 Oct 15:00–19:00 → 21:00–01:00 | T1–T3 | H1 GitHub, H2 Vercel, H2b WalletConnect id, H4 BotFather, H5 bot project on Vercel, H-push | 0: deployed `/api/health` reads Mezo RPC + Merkl |
| B. Night build | Sat 19:00 – Sun 03:00 → 01:00–09:00 | T4–T8, then T9–T13 code | sleep | — |
| C. Morning: live + write | Sun 03:00–09:00 → 09:00–15:00 | fixes, T14, then T15 live check | H-push, review A on phone, **H3 deposit early** | A, B, C (all MUSTs) |
| D. SHOULDs | Sun 09:00–16:00 → 15:00–22:00 | T16–T19 (cut from the bottom) | H7 x402 signature, H-push | D |
| E. Night | Sun 16:00 – Mon 01:00 → 22:00–07:00 | T20 drafts (deck, script, form, PR) | sleep from ~00:00 Dhaka | — |
| F. Materials + submit | Mon 01:00–13:00 → 07:00–19:00 | T21 re-verification | review T20, H6 video, **H8 submit by 13:00 UTC (19:00 Dhaka)** | Final (2 h buffer before 15:00 UTC) |

Night blocks (B, E): Claude works in one long unattended run. Approving this plan pre-approves every dependency and step listed in SPEC/todo. A new "Ask first" item never stops the run: Claude parks it as a note, skips to the next independent task, and leaves the results in your folder plus a short morning report. Live checks that need a deploy wait for your morning H-push.

Cut rule: if Checkpoint C slips past Sun 12:00 UTC (18:00 Dhaka), drop SHOULDs 9 → 8 → 7 → 6 in that order. MUSTs and the materials (T20–T21) are never cut.

## Task List
See `tasks/todo.md`. Summary:

**Phase 1: Foundation.** T1 scaffold + CI · T2 chain module + `/api/health` + hello webhook · T3 carry math (pure, tested) · [H1] GitHub repo · [H2] Vercel web · [H2b] WalletConnect id · [H4] BotFather · [H5] Vercel bot project → Checkpoint 0
**Phase 2: Live read path.** T4 Merkl adapter + identity guard · T5 sMUSD realised-APR adapter · T6a Mezo adapters (SP, pools, borrow params) · T6b Ethereum adapters (Morpho, costs) · T7 `/api/yields` · T8 home page (table + calculator + break-even) → Checkpoint A
**Phase 3: Write action.** T9 wallet + chain switch · T10 `/api/vault` + vault page (read) · T11 deposit / claim / withdraw via `sendSafely` · [H3] dev-wallet run → Checkpoint B
**Phase 4: Reach + judge kit.** T12 Python bot · T13 `/embed` widget · T14 judge pages + README + axe CI · T15 bot live check (bot project set up in Phase 1 as H5) → Checkpoint C
**Phase 5: SHOULDs.** T16 rewards · T17 trove planner · T18 x402 premium · T19 efficiency board → Checkpoint D
**Phase 6: Materials.** T20 deck, video script, AKINDO answers, docs PR draft · T21 final live re-verification · [H6] record video · [H8] submit → Final

## Parallelization
- You do H1, H2, H4 in block A while Claude builds T1–T3.
- T12 is built overnight against the T7 contract (Claude freezes it after T7's contract tests); if your Checkpoint A review changes the shape, T12 is adjusted in block C. `/vault` comes after T10.
- T20 (deck/video script) can be drafted during Phase 5.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Vercel can't reach Boar RPC or Merkl (log #27) | High | Checkpoint 0 is the first deploy; fallback RPCs in env; if Merkl is blocked, serve the last good snapshot with its timestamp |
| Boar RPC rate limits the log scan | Med | Sequential windows, 5-min cache, fallback RPC, fixture test |
| Testnet distributions observed weekly Thu ~00:20 UTC (+ occasional extras), so the dev wallet may show 0 pending at submission | Med | `claimYield` with 0 pending returns 0 (checked, no revert); deposit Sun so pending yield builds during judging; UI shows only "last distribution <time ago>", never a promised date |
| Wallet can't add Mezo testnet / gas estimate fails | Med | viem `mezoTestnet` chain def; `wallet_addEthereumChain`; clear error text; tested with MetaMask + one mobile wallet |
| x402 Permit2 flow fails on 31611 | Low (SHOULD) | Spike inside T18 first (30 min); cut if it fails |
| Merkl campaigns change weekly (Thu) | Med | Nothing hard-coded; tests use fixtures, the UI uses live data; recheck sample address in T21 |
| Bot down during judging (27 Oct–1 Nov) | Med | Webhook function on Vercel has no server to crash or sleep; Vercel function logs; T2 spike deploys a hello-webhook at Checkpoint 0; Railway trial as fallback; README shows `python bot.py --poll` |
| Time overrun | High | Fixed cut rule above; materials protected |

## Open Questions
1. Do we build here and deliver to your folder (recommended), or do you build on your PC with Claude Code?
2. ~~Bot host~~ — decided: Vercel webhook (see SPEC assumption 3).
