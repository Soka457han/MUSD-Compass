import type { Metadata } from "next";
import { SafetyPanel } from "@/components/SafetyPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { VaultPanel } from "@/components/VaultPanel";

export const metadata: Metadata = { title: "Savings Vault (testnet) · MUSD Compass" };

export default function VaultPage() {
  return (
    <>
      <SiteHeader current="/vault" />
      <p role="note" className="bg-accent-soft px-4 py-2 text-center text-sm font-semibold text-ink">
        Testnet action — real Mezo contracts, test funds. APR on Yields is mainnet.
      </p>
      <main id="main" className="flex flex-1 flex-col">
        <h1 className="sr-only">MUSD Savings Vault on Mezo testnet</h1>
        <VaultPanel />
        <SafetyPanel />
      </main>
    </>
  );
}
