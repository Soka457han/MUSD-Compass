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

## Morpho Blue MUSD markets on Mezo (checked 8 Nov 2026, block 13091603, 17:52 UTC)

Sources: AKINDO Wave 1 submissions (https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10?tab=products) and the teams' public repos.

- Mezo mainnet runs Morpho Blue at `0x565834cE7E40b8987BC20EbF83E2159467bDA311` (owner: Mezo multisig; per Surety and Baserate docs).
- Surety (https://surety-credit.vercel.app, github.com/RaYYeR220/surety) created a BTC/MUSD market there, id `0x29c2a844b71bb5db40ca26e8880552dcd40517aa10e945b15ef616c46d5d6707`. VERIFIED live: loan token MUSD `0xdD46…F186`, collateral BTC `0x7b7C…0000`, oracle `0x1cc8daeb91B7da756E3eA1f51eAB8c0776f0cb9B`, IRM AdaptiveCurveIrm `0x3760Ebc636F912a4dB9540fdA4Dec09C25C6C1e7`, LLTV 86%, fee 0. **Supplied 0 MUSD, borrowed 0** (last update 25 Oct 2026). Surety's mainnet vault `0x632d627b66F2b11C8d0Fc61790422B0931D145de` holds 0. The Wave 1 judge said the same ("the mainnet vault holds no MUSD").
- Read path for a supply rate if liquidity arrives: `idToMarketParams(id)` + `market(id)` on Morpho, `borrowRateView(params, market)` on the IRM; supply APY = (e^(rate·year) − 1) × utilization × (1 − fee).

## Other Wave 1 projects (all testnet only, so not mainnet earning spots)

- Baserate (https://baserate-mezo.vercel.app): borrow MUSD on Morpho Blue; deployments only for testnet 31611.
- Janus: veBTC boost market, live on Matsnet (testnet).
- Plumb (github.com/kinnuworks/plumb): MUSD peg module on the MUSD/mUSDC pool; testnet vault, mainnet planned.
- mbLP (https://mblp.surge.sh): BTC to BTC/MUSD LP vault with gauge rewards; testnet.

## Decision

- Task 10 (peg and floor line): build now from the two VERIFIED reads.
- Task 9 (new venues): only Surety's Morpho BTC/MUSD market is on mainnet, and it is empty. Proposed: list it as a size-only venue that ranks itself once MUSD is supplied. Needs the user's OK.
