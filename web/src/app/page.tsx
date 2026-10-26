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
            <ProblemDeck count={sources.venues.filter((v) => v.status === "ok").length} />
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

/** Shown only while the first live read is in flight: the hero's real heading and the shape of the calculator,
 *  so the page never opens on a bare "loading" line and nothing jumps when the numbers arrive. */
function Loading() {
  const box = "rounded-full bg-card";
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 md:px-6 md:pt-14" aria-busy="true">
      <p role="status" className="sr-only">
        Loading live rates
      </p>
      <div className="grid gap-7 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-12" aria-hidden="true">
        <div className="flex flex-col gap-4 md:gap-5">
          <p className="text-[30px] leading-[1.15] font-extrabold tracking-tight md:text-[56px] md:leading-[1.06]">Where your MUSD earns most, after costs.</p>
          <p className="text-ink-muted md:max-w-[520px] md:text-lg">Every Mezo earning spot, ranked by the cash you keep. Live from Mezo and Ethereum.</p>
          <div className="grid gap-4 rounded-2xl border border-line bg-surface p-4 md:mt-2 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-end xl:gap-3.5 xl:border-0 xl:bg-transparent xl:p-0">
            <div className={`h-[54px] ${box}`} />
            <div className={`h-[54px] xl:w-[170px] ${box}`} />
            <div className={`h-[54px] xl:w-[184px] ${box}`} />
          </div>
        </div>
        <div className="h-[260px] animate-pulse rounded-[20px] border border-line bg-card md:h-[330px]" />
      </div>
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
