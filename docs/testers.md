# Try MUSD Compass on Mezo testnet

This takes about ten minutes, most of it waiting on the faucet. Everything runs on Mezo testnet with test funds that have no value. Compass never asks for a seed phrase or a private key, and neither should anyone else. Share only public addresses and transaction links.

## What we need from you

One real transaction from your own wallet. A deposit into the Savings Vault is enough. If you want to go further, Borrow → Earn opens a testnet trove and deposits what it borrows, in three wallet prompts.

Send us the explorer link of your transaction. That link is the proof that someone outside our own wallets used the app.

## Steps

1. Open [musd-compass.vercel.app/vault](https://musd-compass.vercel.app/vault) and press Connect wallet. A browser wallet such as MetaMask or Rabby shows up by name. For a wallet on your phone, choose WalletConnect and scan the code. Compass adds Mezo testnet to your wallet if it is missing.
2. Take test BTC from the [Mezo testnet faucet](https://faucet.test.mezo.org). Paste your public address and complete its check yourself. It sends 0.05 BTC and 100 MEZO, and you can ask again after about a day.
3. On [testnet.mezo.org](https://testnet.mezo.org), connect the same wallet and swap part of the BTC for MUSD. Keep a little BTC for gas.
4. Back on the vault page, type an amount under Deposit MUSD and press Deposit. Compass approves exactly that amount, simulates the transaction, then asks your wallet to confirm.
5. Press View on explorer next to the confirmed transaction and copy the address of that page.

## Optional: Borrow → Earn

The Borrow section on the same page opens a trove with your test BTC and deposits the MUSD it borrows into the vault. Mezo requires at least about 1,800 MUSD of debt, so you need a little more test BTC than one faucet claim gives. The page shows how much BTC it will lock before you confirm anything, and it will not start a trove below a 200% collateral ratio.

## If something fails

Compass says what went wrong in plain words and sends nothing when a check fails. A reverted or refused transaction is useful to us too: tell us what the page said.

## What to send back

Your explorer link, plus anything that confused you. A short message is enough:

> Tried MUSD Compass on testnet. Wallet 0x… , transaction link: https://explorer.test.mezo.org/tx/0x… . It took N minutes. The step that was unclear: …
