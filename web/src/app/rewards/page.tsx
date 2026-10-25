import type { Metadata } from "next";
import { RewardsPanel } from "@/components/RewardsPanel";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Unclaimed veMEZO rewards · MUSD Compass" };

export default function RewardsPage() {
  return (
    <>
      <SiteHeader current="/rewards" />
      <main id="main" className="flex flex-1 flex-col">
        <h1 className="sr-only">Unclaimed veMEZO rewards</h1>
        <RewardsPanel />
      </main>
    </>
  );
}
