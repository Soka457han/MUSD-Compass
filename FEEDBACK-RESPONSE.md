# What changed since Wave 1

This page takes the Wave 1 review one ask at a time. Each row says what was built, where to check it, and what is still open. Where something is not finished, a **Pending** line says so. Nothing here is claimed without a link, a transaction or a test.

> Your Mezo integration is already deep: the live app reads PriceFeed, TroveManager, StabilityPool and the sMUSD gauge, and the /vault flow opens real troves and deposits into sMUSD on testnet. To push higher in Wave 2, take the Borrow -> Earn flow to mainnet with HintHelpers, add monitoring and top-up or repay for the trove it opens (including redemption and Recovery Mode warnings), and show users outside your own wallets using it. On product, set a real mainnet x402 price and show who would pay for the premium API and why. Also add WalletConnect or Mezo Passport, fill in the team and track fields, and update the README video and deck links.
>
> Wave 1 review, 31 Oct 2026

## 1. Borrow → Earn on mainnet with HintHelpers

**Built.** `/vault` has a Mezo testnet / Mezo mainnet switch. On mainnet, Borrow → Earn gets real HintHelpers hints, opens the trove, approves the exact amount and deposits into the Savings Vault, each step behind a typed-amount confirmation. Every transaction passes one guard ([`sendSafely.ts`](web/src/lib/sendSafely.ts)): allowlisted contracts and functions only, approvals only to the vault and never unlimited, and a 2,500 MUSD limit per deposit, stake and new trove. The limit is Compass's own safety limit. Mezo sets no maximum ([check](docs/evidence.md)).

**On chain.** The mainnet Savings Vault and gauge flow ran with real funds through the `/vault` page on 12 Nov 2026: [8 transactions](https://musd-compass.vercel.app/proof), 5 MUSD in and out, staked and unstaked, MEZO claimed. The opening of a trove with HintHelpers on mainnet passed read-only simulation against Mezo mainnet on 3 and 10 Nov ([evidence](docs/evidence.md)).

**Pending:** a real mainnet `openTrove` transaction. A new trove needs about 0.054 BTC locked (Mezo's minimum debt is 1,800 MUSD), so it is not yet in the proof list.

## 2. Monitoring, top-up or repay, redemption and Recovery Mode warnings

**Built.**
- **Monitoring:** `/watch` in the Telegram bot checks a trove on a schedule set to every 15 minutes and sends an alert when its advice changes, with a margin so it does not flip near 200%. GitHub Actions starts scheduled runs late: the last 6 runs (12 to 13 Nov 2026) were 4 to 7 hours apart, so in practice an alert can take hours unless the run is started by hand.
- **Warnings:** the trove page and the alerts say when a trove is close to the liquidation line, when it is near the front of the redemption line, and when the system is in Recovery Mode. The page also states the MUSD price against the redemption floor every time.
- **Top-up and repay:** on `/vault`, mainnet, with a before and after preview (new ratio, and place in the redemption line now and after).

**Checked.** A real mainnet trove at 116% shows both warnings live. Recovery Mode cannot be shown live because Mezo is not in it; it is covered by a unit test.

**Pending:** a live `/watch` alert from a real trove in a real Telegram chat, and a real mainnet top-up or repay transaction.

## 3. Users outside your own wallets

**Built.** `/stats` counts bot users, outside x402 payers, widget sites and API requests, with the start date of the count, so the number can be checked by anyone.

**Pending, and honest:** as of 13 Nov 2026, `/stats` shows 1 bot user since 8 Nov. That one chat is not shown to be outside the team. No outside payer or widget site yet. Compass has no outside-user proof today.

## 4. A real mainnet x402 price, and who would pay

**Built.** The premium API is priced at 0.01 MUSD per call on Mezo mainnet (10 MUSD per 1,000), and 0.001 test MUSD on testnet ([`x402.ts`](web/src/lib/x402.ts)). [/developers](https://musd-compass.vercel.app/developers) names who pays and why: servers that need the ranking for many amounts or addresses, agents that cannot sign up for an API key, wallets that show where to put MUSD, and alert bots. The pay button on `/developers` works on both networks; on mainnet it asks you to type 0.01 first and refuses any other token, amount or payee before the wallet signs.

**On chain.** A real mainnet payment: 0.01 MUSD from the builder's wallet `0x9126…6976` to the payee `0xfe21…676C` on 13 Nov 2026, sent by the facilitator, which paid the gas ([transaction](https://explorer.mezo.org/tx/0x794f8b211352068d2474dc4a2c5ec042d48476c27fbebd1272f4601f245c09cf)). Two testnet payments are also listed, one from a second wallet ([proof](https://musd-compass.vercel.app/proof)).

**Pending:** a paid mainnet call from someone outside the team. The mainnet payment above is the builder's own wallet.

## 5. WalletConnect or Mezo Passport

**Built.** WalletConnect and browser wallets work on `/vault`. Unisat, OKX and Xverse (Bitcoin wallets) show the wallet's Mezo account and its position, view only.

**Tried and left out:** full Passport support. The trial build failed with 22 errors, it needs React 18 while the site runs React 19, it raised known advisories from 1 to 107, and it is GPL-3.0 while Compass is MIT. Bitcoin-wallet actions would also have to leave Compass's guard through a Mezo relay.

## 6. Team and track fields, video and deck links

- **README links:** fixed. The video and deck links are real links now.
- **Pending:** the AKINDO team and track fields, the Wave 2 video (under 2:15) and the Wave 2 deck. These are filled in on AKINDO by the builder.

## Also added since Wave 1

- **Gauge staking** on `/vault`: stake, unstake and claim MEZO, with the same typed confirmation and limit.
- **Mezo pools** ranked with their MEZO emission APR read from the gauges on chain (checked against the Mezo app on 8 Nov), and the exit depth before MUSD falls below $0.99.
- **No wallet needed to see it work:** *Try a sample* on `/vault` and `/trove` shows every feature on a real address, with the controls switched off.
- **[/proof](https://musd-compass.vercel.app/proof):** every transaction Compass has sent, with explorer links.

## Check it yourself

1. [/proof](https://musd-compass.vercel.app/proof): open any hash on the explorer.
2. [/vault](https://musd-compass.vercel.app/vault) → *Try to break it*: an unlimited approval, an unknown contract and a 1,000,000 MUSD deposit are refused with no wallet.
3. [/trove](https://musd-compass.vercel.app/trove) → *Try a sample*: a live mainnet trove with its warnings.
4. [Evidence](docs/evidence.md): every claim above with its source and date.
