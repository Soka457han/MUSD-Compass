import { connection } from "next/server";
import { Suspense } from "react";
import { Compass } from "@/components/Compass";
import { Channels, Faq, HowItWorks, Trust } from "@/components/Landing";
import { ProblemDeck } from "@/components/ProblemDeck";
import { SiteHeader } from "@/components/SiteHeader";
import { loadSources } from "@/lib/sources";

async function LiveCompass() {
  await connection(); // venues are read per request from the shared 5-minute cache, never frozen at build time
  const sources = await loadSources();
  return (
    <Compass
      sources={sources}
      between={
        <>
          {/* Full bleed on phones: the stacked cards are placed against the screen width. */}
          <div className="-mx-4 md:mx-0">
            <ProblemDeck count={sources.venues.length} />
          </div>
          <HowItWorks />
        </>
      }
      after={
        <>
          <Trust />
          <Channels />
          <Faq />
        </>
      }
    />
  );
}

function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6" aria-busy="true">
      <p className="text-sm font-semibold">Reading Mezo and Ethereum…</p>
    </main>
  );
}

export default function Home() {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-30 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent">
        Skip to venues
      </a>
      <SiteHeader current="/" />
      <Suspense fallback={<Loading />}>
        <LiveCompass />
      </Suspense>
    </>
  );
}
