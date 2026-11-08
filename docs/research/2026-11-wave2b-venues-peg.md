# Wave 2b research gate: venues and the MUSD peg (8 Nov 2026)

Every value below was read live on Mezo mainnet (chain 31612) through `https://rpc-http.mezo.boar.network`, block 13087625 to 13087631 (8 Nov 2026, 13:38 to 13:39 UTC), unless marked otherwise.

## MUSD redemption fee — VERIFIED

- Contract: BorrowerOperations `0x44b1bac67dDA612a41a58AAf779143B181dEe031` (already used by Compass).
- Read: `redemptionRate()` (selector `0x540385a3`), 1e18 precision. Source: `mezo-org/musd` `solidity/contracts/BorrowerOperations.sol` line 129, initial value `(DECIMAL_PRECISION * 3) / 400`.
- Live value: `0.0075` (0.75%).
- Floor: redeeming 1 MUSD returns $1 of BTC minus 0.75%, so redemption pays when MUSD trades under **$0.9925**. Mezo's user docs (https://mezo.org/docs/users/musd) state "profitable until MUSD reaches $0.995"; the docs do not show that arithmetic, so Compass shows the on-chain figure and names the rate it came from.

## MUSD market price — VERIFIED (with one assumption)

- Pool: MUSD/mUSDC concentrated-liquidity pool `0xcc372b7e15535ab225fe17c1075831d38ef7ac1a` (Compass's `MAINNET.pools.musdcMusdCl10`).
  - token0 `0x04671c72aab5ac02a03c1098314b1bb6b560c197` (mUSDC, 6 decimals), token1 `0xdd468a1ddc392dcdbef6db6e34e89aa338f9f186` (MUSD, 18 decimals).
- Read: `slot0()` (selector `0x3850c7bd`), first word `sqrtPriceX96`.
- Live value at block 13087631 (timestamp 1794145147): `sqrtPriceX96 = 79573356042004189394853931856270274`, i.e. 1.00874 MUSD per mUSDC, so **MUSD ≈ $0.9913**.
- Pool balances at that block: 120,097.59 mUSDC and 13,316.99 MUSD.
- Assumption: mUSDC = $1. Compass says so next to the number.
- The basic MUSD/mUSDC pool `0xEd812AEc0Fecc8fD882Ac3eccC43f3aA80A6c356` holds only about 4,866 mUSDC and 6,734 MUSD and implies $0.72, so it is not used as a price source.
- Cross-check: the user reported Plumb showing about $0.9899 on the same day.

## Morpho Blue MUSD markets on Mezo — UNKNOWN

No source read so far documents a Morpho Blue deployment on Mezo, a market id, LLTV or oracle. Not built until the user supplies the app or contract links and each market is read on chain.

## veBTC gauge and boost yields (Janus, Plumb, mbLP) — UNKNOWN

No source read so far describes these; the musd repo and the Mezo MUSD docs do not mention them. Not built until links are supplied and the reward rates are read on chain.

## Decision

- Task 10 (peg and floor line): build now from the two VERIFIED reads.
- Task 9 (new venues): waits for links from the user.
