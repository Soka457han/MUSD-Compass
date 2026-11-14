import type { Metadata } from "next";
import { SafetyPanel } from "@/components/SafetyPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { VaultPanel } from "@/components/VaultPanel";
import { mainnetWritesEnabled } from "@/lib/sendSafely";

const live = mainnetWritesEnabled(); // set at build time, so the page is still static
export const metadata: Metadata = { title: live ? "Savings Vault · MUSD Compass" : "Savings Vault (testnet) · MUSD Compass" };

export default function VaultPage() {
  return (
    <>
      <SiteHeader current="/vault" />
      <p role="note" className="bg-accent-soft px-4 py-2 text-center text-sm font-semibold text-ink">
        {live ? "Starts on Mezo testnet with test funds. Choose Mezo mainnet below to use real funds, capped per transaction." : "Testnet action — real Mezo contracts, test funds. APR on Yields is mainnet."}
      </p>
      <main id="main" className="flex flex-1 flex-col">
        <h1 className="mx-auto w-full max-w-3xl px-4 pt-6 text-[28px] leading-tight font-extrabold tracking-tight text-balance md:pt-10 md:text-[40px]">MUSD <span className="hl">Savings Vault</span> on Mezo{live ? "" : " testnet"}</h1>
        <VaultPanel />
        <SafetyPanel />
      </main>
    </>
  );
}
