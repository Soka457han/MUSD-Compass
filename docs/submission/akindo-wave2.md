# AKINDO submission, Wave 2 (resubmission)

Field by field, in the order of the official form. Copy each block into its box. Lines marked FILL need something only you can give; each says what. The judge's review of Wave 1 is answered point by point under "What changed since Wave 1", and every claim there links to something a reviewer can open.

## Project name
MUSD Compass

## Project category (3 to 5 words)
Yield discovery and trove safety

## TL;DR (one sentence)
MUSD Compass ranks where Mezo's MUSD earns the most after costs, and in Wave 2 it also helps you act safely: open a trove and deposit its MUSD with real hints, see how close your trove is to liquidation and fix it, from your phone, Telegram or an API.

## How it works
The problem. MUSD can earn in the Savings Vault, the Stability Pool, six Mezo pools and Mezo-paid pools on Ethereum, and each shows a different number. Some pay cash, some pay veMEZO locked for 12 weeks, and borrowers pay a fee and interest on the whole debt. Nobody shows what you keep. Borrowers have a second problem: a trove can fall toward liquidation or sit first in the redemption queue, and nothing tells them in plain words what to do.

How it functions. Compass reads Mezo mainnet, Ethereum and Merkl and ranks every MUSD venue by net carry, cash first, with locked veMEZO shown beside it and never mixed in. Wave 2 adds the step after the ranking. You connect a wallet (a browser wallet or a phone wallet by QR code), open a trove and deposit the borrowed MUSD in the Savings Vault in three prompts, then watch the trove: its ratio, how far BTC can fall before liquidation, where it sits in the redemption queue, and a sized suggestion (add this much BTC or repay this much MUSD) with buttons that do it.

How MUSD and MEZO are used. MUSD is the asset every ranking is about, the borrowed and deposited amount in Borrow → Earn, and the payment for the premium API over x402. MEZO and veMEZO incentives are priced at MEZO spot and kept apart from cash. Compass sends people into Mezo's own vault, troves and Merkl claims instead of rebuilding them, and it writes only to BorrowerOperations, the Savings Vault and MUSD.

## What changed since Wave 1
The Wave 1 review asked for six things. Here is each one, what exists now, and what does not exist yet.

1. Borrow → Earn with HintHelpers, and mainnet.
   Done on testnet: the trove is opened with real hints from Mezo's HintHelpers (Wave 1 sent zero hints), the price is read again right before the first transaction and a trove that would start under 200% is refused. Mainnet is built and switched off in the public site. It has been simulated, not executed, because the builder does not hold the roughly 0.057 BTC a 2,000 MUSD trove needs. The simulation runs Compass's own code against Mezo mainnet: the trove opens in `eth_call` with real hints, and a trove with too little collateral is refused by the contract. Evidence and the command to rerun it: https://github.com/Soka457han/MUSD-Compass/blob/main/docs/evidence.md

2. Monitoring, top-up and repay, with redemption and Recovery Mode warnings.
   Done on testnet and read-only on mainnet. `/trove` and the new "Your trove" section on `/vault` show the ratio, the distance to liquidation at 110%, the redemption-queue note and Recovery Mode, with one of three levels (all clear, keep an eye, act now). The suggestions are sized: BTC to add, or MUSD to repay. A repay is withheld when it would push the debt under Mezo's 1,800 MUSD minimum, and the page says why. Add BTC and Repay MUSD are real transactions, simulated first. Closing or withdrawing stays in the Mezo app. FILL (the strongest proof, optional): the explorer link of one real testnet top-up from the dev wallet; until it exists, say only that the action is built and checked up to the wallet prompt.

3. Show users outside our own wallets.
   FILL: the outside wallets found by 11 Nov, each as an address plus an explorer link to its transaction, checked by hand on explorer.test.mezo.org. If fewer than three, write the real number and say so. Testers followed https://github.com/Soka457han/MUSD-Compass/blob/main/docs/testers.md. All work is on Mezo testnet, so none of it is mainnet usage.

4. A real mainnet x402 price, and who would pay.
   The price is set: 0.01 MUSD per call on Mezo mainnet (0.001 test MUSD on testnet). The x402 facilitator lists MUSD on Mezo mainnet, so this is a real payment requirement, and the 402 response offers it. The buyers are wallets and apps that show where to put MUSD, agents that rebalance and watch a trove, and alert bots; the paid call replaces eight free requests, and the free API allows 60 a minute per IP. Both payments on record are ours (one from a second wallet), so there are no outside buyers yet, and no paid call has been made on mainnet. FILL (before you submit): run `curl -i "https://musd-compass.vercel.app/api/premium/yields?amount=2000"` and confirm the response lists `eip155:31612`; it does only after `X402_MAINNET_PAY_TO` is set in Vercel. If it does not, change this item to say the mainnet price is configured but not yet offered. Details and the buyer list: https://musd-compass.vercel.app/developers

5. WalletConnect or Mezo Passport.
   WalletConnect is built: Connect wallet now offers phone wallets by QR code, loaded only when tapped. The QR window was checked in a browser with the project's Reown id. FILL: one line on your own phone test (wallet name, and whether connect, a deposit and the explorer link worked); remove this sentence if you did not run one. Mezo Passport stays on the roadmap.

6. Housekeeping.
   The README video link was malformed and is fixed, the deck link is added, test counts are current, and team and track are filled in below.

## Safety, as it stands
Every write passes one guard that checks the network and the wallet's chain, then allows only the exact functions Compass uses on each contract. Review in Wave 2 found that the guard allowed any function on MUSD and on the vault; that is fixed and covered by tests. Mainnet writes need a deploy-time switch and, on screen, the typed amount. Details: https://github.com/Soka457han/MUSD-Compass#safety-and-threat-model

## Target group
MUSD holders and borrowers on Mezo, and BTC holders deciding whether to borrow MUSD. Retail and DeFi users from beginner to intermediate, global, phone first. Borrowers are the new focus: they need a clear answer to "is my trove safe, and what do I do". Developers and agents use the same numbers through the free API, the widget and the paid call.

## Tech stack
Next.js 16 (App Router, React 19) on Vercel, TypeScript, viem, Tailwind CSS 4, WalletConnect provider 2.26.0 (Reown), x402 (`@x402/next`, `@x402/evm`, `@x402/fetch`), a Python Telegram webhook, the Merkl API, Vitest, Playwright with axe, pytest, GitHub Actions CI.

## Track
Both, Track 1 (DeFi) and Track 2 (Access and Distribution)

## Chain deployed on
Mezo. It reads Mezo mainnet and Ethereum. Wallet actions and the paid calls made so far run on Mezo testnet; the mainnet trove path is built, simulated and off, and the mainnet x402 price is offered once a payee is set.

## Project status
Existing project with new features added during Wave 2. Wave 1 submission: https://app.akindo.io/communities/gXle8B7JkfDV7WQE/products/Mz9eqoGPnFVlRJKm

## Project readiness
Testnet deployment, with a mainnet path built and simulated but not executed.

## Future milestones
1. Capped mainnet Borrow → Earn or Savings Vault deposit, December 2026. It needs funds for the minimum trove and a review of the capped launch first.
2. Per-user alerts in the Telegram bot ("your trove is below 200%", "veMEZO waiting to claim") and Mezo Passport for Bitcoin wallets, December 2026 to January 2027. Alerts need a small database.
3. A first paid mainnet call from an outside buyer, a review of the 0.01 MUSD price, and a shared rate-limit store, January 2027.

## Team info
Solo builder: product, design, web app, on-chain integration and the Telegram bot. GitHub: https://github.com/Soka457han. FILL: your X or LinkedIn link.

## Links
- Live app: https://musd-compass.vercel.app
- GitHub: https://github.com/Soka457han/MUSD-Compass
- Telegram bot: https://t.me/musd_compass_bot
- API, widget and x402: https://musd-compass.vercel.app/developers
- Deck: https://musd-compass.vercel.app/musd-compass-deck.pdf
- 2-minute video: FILL: the Wave 2 video link. The Wave 1 video is https://www.youtube.com/watch?v=MzgrWvwby00
