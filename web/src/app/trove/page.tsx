import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { TrovePanel } from "@/components/TrovePanel";

export const metadata: Metadata = { title: "Trove planner · MUSD Compass" };

export default function TrovePage() {
  return (
    <>
      <SiteHeader current="/trove" />
      <main id="main" className="flex flex-1 flex-col">
        <h1 className="sr-only">Trove planner</h1>
        <TrovePanel />
      </main>
    </>
  );
}
