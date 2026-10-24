import { connection } from "next/server";
import { Suspense } from "react";
import { Compass } from "@/components/Compass";
import { SiteHeader } from "@/components/SiteHeader";
import { loadSources } from "@/lib/sources";

async function LiveCompass() {
  await connection(); // venues are read per request from the shared 5-minute cache, never frozen at build time
  return <Compass sources={await loadSources()} />;
}

function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6" aria-busy="true">
      <p className="text-sm font-semibold">Reading Mezo and Ethereum…</p>
    </main>
  );
}

export default function Home() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-yellow focus:px-3 focus:py-2 focus:text-on-yellow">
        Skip to venues
      </a>
      <SiteHeader current="/" />
      <Suspense fallback={<Loading />}>
        <LiveCompass />
      </Suspense>
    </>
  );
}
