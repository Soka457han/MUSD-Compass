# Mainnet Actions (Wave 2e) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Compass write work on Mezo mainnet behind `NEXT_PUBLIC_MAINNET_WRITES=1`, with a hard cap, so the owner can switch it on after one funded test.

**Architecture:** The write path already exists (`sendSafely.ts` guard, `borrowEarn.ts`, `troveActions.ts`, `hints.ts`, `MainnetConfirm.tsx`). Borrow → Earn, top-up and repay already take a network. The Savings Vault half (read, deposit, withdraw, claim) is hard-wired to testnet. This plan gives the vault a network, puts the cap inside the guard so no UI path can skip it, and moves the network choice to the top of `/vault`.

**Tech Stack:** Next.js 16, viem 2.57, Vitest, Playwright.

**Spec:** the Wave 1 judge comment (Borrow → Earn on mainnet with HintHelpers; top-up or repay; redemption and Recovery Mode warnings; WalletConnect or Passport) and README "Wave 2" item 1 (capped mainnet Savings Vault deposits).

## What already exists (read 10 Nov 2026, commit 207cac3)

| Ask | State |
|---|---|
| Borrow → Earn on mainnet with HintHelpers | Built, flag-gated: `buildBorrowEarnSteps`, `getTroveHints`, `assertSafeAtSend`, typed-amount dialog |
| Top-up and repay | Built for both networks: `buildTopUpStep`, `buildRepayStep` |
| Recovery Mode and redemption warnings | Built: `troveAdvice` (page, API, `/watch` alerts) |
| WalletConnect | Built, on when the Reown id is set |
| Mainnet Savings Vault deposit, withdraw, claim | **Missing**: `VaultPanel` and `/api/vault` use `TESTNET` only |
| Hard cap | **Missing** |
| Network choice | Hidden inside the Borrow section, after a testnet read succeeds |

## Mainnet checks (read-only `eth_call`, Boar RPC, 10 Nov 2026)

- chain 31612; BorrowerOperations points at the SortedTroves and TroveManager in `addresses.ts`.
- `minNetDebt` 1,800; `borrowingRate` 0.1%; gas compensation 200; BTC $74,131.86; Recovery Mode off; TCR 2,734%; 4 troves.
- `openTrove(2000 MUSD)` with `getApproxHint` + `findInsertPosition` hints: passes (gas 605,050). With zero hints: passes (gas 631,633). With 100 MUSD: reverts "net debt must be greater than minimum".
- `addColl` and `repayMUSD(1)` from the lowest-ratio trove owner: pass. `addColl` from an address with no trove: reverts "Trove does not exist or is closed".
- sMUSD: `withdraw(1)` and `claimYield()` from a holder pass; `deposit(1)` with no allowance reverts with `ERC20InsufficientAllowance` (0xfb8f41b2) naming the vault as spender; `approve(vault, 1)` on MUSD returns true.

## Global Constraints

- Flag stays empty in the repo and `.env.example`. Mainnet is offered only when `NEXT_PUBLIC_MAINNET_WRITES === "1"`.
- No custody, no own contracts, no new dependencies.
- Cap: `MAINNET_CAP_MUSD = 2_500` per transaction for vault deposits, MUSD approvals and new-trove debt. Top-up, repay, withdraw and claim are not capped (they lower risk or return funds).
- Copy rules: no em or en dashes in new copy, no "not X but Y", every number states its source.
- Testnet behaviour and its e2e texts do not change when the flag is off.

## Review Focus

- Switching network while a read is in flight must never show testnet balances under a mainnet label.
- An approval or deposit one wei over the cap is refused in the guard, before simulation.
- A mainnet deposit never reaches the wallet before the typed-amount dialog is confirmed.
- With the flag off, `?net=mainnet` in the URL does nothing.
- A non-bigint or zero amount for deposit or withdraw is refused in the guard.

---

### Task 1: Cap in the guard

**Files:** Modify `web/src/lib/sendSafely.ts`; Test `web/tests/unit/sendSafely.test.ts`

**Interfaces:** Produces `export const MAINNET_CAP_MUSD = 2_500` and guard errors `/at most 2,500 MUSD/`.

- [ ] Failing tests: mainnet `deposit(2500e18)` passes, `deposit(2500e18 + 1)` throws; same for `approve` and `openTrove` debt; testnet `deposit(1_000_000e18)` passes the guard; `deposit(0n)`, `deposit("5")`, `withdraw(0n)` throw `/more than zero/` on both networks; mainnet `withdraw(10_000e18)` passes.
- [ ] Implement in `guard`. Run `npx vitest run tests/unit/sendSafely.test.ts`.

### Task 2: Vault reads per network

**Files:** Modify `web/src/lib/vault.ts`, `web/src/app/api/vault/[address]/route.ts`; Test `web/tests/unit/vault.test.ts`

**Interfaces:** `readVault(client, address, lastDistribution, network: NetworkId = "testnet")`; `GET /api/vault/{address}?network=mainnet` answers with `network: "Mezo mainnet"` and the last distribution from `loadSources()`.

- [ ] Failing test: `readVault(..., "mainnet")` reads `MAINNET.musd` and `MAINNET.smusd`.
- [ ] Implement; any other `network` value is a 400.

### Task 3: VaultPanel on the chosen network

**Files:** Modify `web/src/components/VaultPanel.tsx`, `web/src/app/vault/page.tsx`, `web/src/lib/borrowEarn.ts`; Test `web/tests/unit/borrowEarn.test.ts`, `web/e2e/mainnet.spec.ts` (runs only with `MAINNET_E2E=1` against a flag-on build)

- [ ] Network radio in the Wallet section (flag on only), preset by `?net=mainnet`; disabled while busy; changing it clears the position and re-reads; stale responses are dropped.
- [ ] Deposit, withdraw and claim use `NETWORKS[net]`; mainnet deposit and withdraw wait behind `MainnetConfirm`; deposit over the cap is refused on screen.
- [ ] `buildBorrowEarnSteps` throws above the cap on mainnet (test first).
- [ ] e2e with a mock EIP-1193 wallet and a mocked RPC: nothing is sent before the amount is typed; the first transaction goes to mainnet MUSD `approve(vault, exact)`; 3,000 MUSD is refused.

### Task 4: Links and copy

**Files:** Modify `web/src/components/TrovePanel.tsx`, `web/src/lib/alerts.ts`, `web/src/components/Landing.tsx`, `web/src/components/SafetyPanel.tsx`, `.env.example`, `CHANGELOG.md`; Test `web/tests/unit/alerts.test.ts`

- [ ] Flag on: trove page and alerts link to `/vault?net=mainnet` for top-up and repay. Flag off: unchanged.
- [ ] FAQ answers follow the flag and `walletConnectEnabled()`.
- [ ] "Try to break it" gains: deposit 1,000,000 MUSD on mainnet, refused by the cap.

### Task 5: Verify and security pass

- [ ] `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run e2e` (flag off), then a flag-on build with `MAINNET_E2E=1 npx playwright test e2e/mainnet.spec.ts`.
- [ ] Adversarial guard table (every function × wrong contract, wrong chain, over cap, wrong arg types), `npm audit --omit=dev`, secrets grep, CSP still lists only the two Mezo RPCs and WalletConnect hosts.

## Owner steps after delivery (Claude never holds keys)

1. Push. Production stays testnet-only because the flag is empty.
2. In Vercel, set `NEXT_PUBLIC_MAINNET_WRITES=1` on a Preview deployment only.
3. With a small wallet: deposit 5 MUSD, withdraw it, then top up or repay a trove if you have one. Send the transaction hashes for `docs/evidence.md`.
4. Only then set the flag on Production.
