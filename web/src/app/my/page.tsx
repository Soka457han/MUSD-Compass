import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MyPanel } from "@/components/MyPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { loadSources } from "@/lib/sources";

export const metadata: Metadata = { title: "My MUSD · MUSD Compass" };

async function Live() {
  // Rendered per request, not at build time: a slow chain read during the build stopped two deploys on 26 Oct.
  await connection();
  return <MyPanel sources={await loadSources()} />;
}

export default function MyPage() {
  return (
    <>
      <SiteHeader current="/my" />
      <main id="main" className="flex flex-1 flex-col">
        <h1 className="sr-only">My MUSD</h1>
        <Suspense
          fallback={
            <p className="mx-auto w-full max-w-3xl px-4 py-5 text-sm">
              Loading live rates…
            </p>
          }
        >
          <Live />
        </Suspense>
      </main>
    </>
  );
}
