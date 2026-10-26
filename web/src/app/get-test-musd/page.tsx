import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRightIcon } from "@/components/Icons";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Get test MUSD · MUSD Compass" };

const SECTION = "rounded-[20px] border border-line bg-card px-5 py-5";
const H2 = "flex items-baseline gap-2 text-base font-bold";
const OUT = "inline-flex items-center gap-1 font-semibold underline";

function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={OUT}>
      {children}
      <ArrowUpRightIcon className="size-4" title="(opens in a new tab)" />
    </a>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className={SECTION}>
      <h2 className={H2}>
        <span className="price text-3xl" aria-hidden="true">{n}</span>
        <span>
          <span className="sr-only">Step {n}: </span>
          {title}
        </span>
      </h2>
      <div className="mt-2 max-w-prose space-y-2 text-sm">{children}</div>
    </li>
  );
}

export default function GetTestMusdPage() {
  return (
    <>
      <SiteHeader current="/get-test-musd" />
      <p role="note" className="bg-accent-soft px-4 py-2 text-center text-sm font-semibold text-ink">
        Testnet only — these tokens have no value. Compass never asks for keys or seed phrases.
      </p>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <h1 className="text-[30px] leading-tight font-extrabold tracking-tight md:text-[40px]">
          Get test MUSD in 3 steps
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">About 5 minutes with any EVM wallet (MetaMask, Rabby, a phone wallet&apos;s browser).</p>
        <ol className="mt-4 space-y-5">
          <Step n={1} title="Add Mezo testnet to your wallet">
            <p>
              The <Link href="/vault" className="font-semibold underline">Vault</Link> page adds it for you when you press Connect wallet. To add it by hand:
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-ink-muted">Network</dt>
              <dd>Mezo Testnet</dd>
              <dt className="text-ink-muted">Chain ID</dt>
              <dd>31611</dd>
              <dt className="text-ink-muted">RPC</dt>
              <dd className="break-all">https://rpc.test.mezo.org</dd>
              <dt className="text-ink-muted">Currency</dt>
              <dd>BTC</dd>
              <dt className="text-ink-muted">Explorer</dt>
              <dd className="break-all">https://explorer.test.mezo.org</dd>
            </dl>
          </Step>
          <Step n={2} title="Take test BTC from the faucet">
            <p>
              Open the <Out href="https://faucet.test.mezo.org">Mezo testnet faucet</Out>, paste your public address and complete its check yourself. It sends 0.05 BTC and 100 MEZO, once about every 24 hours.
            </p>
          </Step>
          <Step n={3} title="Swap some BTC for MUSD">
            <p>
              On <Out href="https://testnet.mezo.org">testnet.mezo.org</Out>, connect the same wallet and swap part of the BTC for MUSD. Keep a little BTC: it pays the gas.
            </p>
          </Step>
        </ol>
        <p className="mt-5 text-sm">
          Then{" "}
          <Link href="/vault?action=deposit&amount=100" className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 font-bold text-on-accent no-underline">
            Deposit 100 MUSD in the Savings Vault
          </Link>
        </p>
      </main>
    </>
  );
}
