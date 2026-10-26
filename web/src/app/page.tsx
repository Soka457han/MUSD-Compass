import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { Compass } from "@/components/Compass";
import { Channels, Faq, HowItWorks, Trust } from "@/components/Landing";
import { ProblemDeck } from "@/components/ProblemDeck";
import { SiteHeader } from "@/components/SiteHeader";
import { loadSources } from "@/lib/sources";

/** The whole ranking is cached with the page: it is built ahead of time and served at once, and after 5 minutes the
 *  next visit gets it immediately while a fresh copy is built in the background (it used to be read on every
 *  request, so each visit waited 0.5–1 s, longer when a function was cold). */
async function cachedSources() {
  "use cache";
  cacheLife({ revalidate: 300, expire: 86_400 });
  return loadSources();
}

async function LiveCompass() {
  const sources = await cachedSources();
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
/** Shown only if the ranking is not ready yet: the hero's real text and the shape of everything below it,
 *  in grey blocks that pulse, so the page never opens on bare text and nothing jumps when the numbers arrive. */
function Loading() {
  const block = "animate-pulse rounded-[20px] bg-surface";
  const field = "h-[54px] animate-pulse rounded-full border border-line bg-card";
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 md:px-6 md:pt-14" aria-busy="true">
      <p role="status" className="sr-only">
        Loading live rates
      </p>
      <div aria-hidden="true">
        <div className="grid gap-7 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-12">
          <div className="flex flex-col gap-4 md:gap-5">
            <p className="text-[30px] leading-[1.15] font-extrabold tracking-tight md:text-[56px] md:leading-[1.06]">Where your MUSD earns most, after costs.</p>
            <p className="text-ink-muted md:max-w-[520px] md:text-lg">Every Mezo earning spot, ranked by the cash you keep. Live from Mezo and Ethereum.</p>
            <div className="grid gap-4 rounded-2xl border border-line bg-surface p-4 md:mt-2 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-end xl:gap-3.5 xl:border-0 xl:bg-transparent xl:p-0">
              <div className={field} />
              <div className={`${field} xl:w-[170px]`} />
              <div className={`${field} xl:w-[184px]`} />
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-[20px] border border-line p-[22px] md:p-8">
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-surface" />
            <div className="h-16 w-1/2 animate-pulse rounded-2xl bg-surface md:h-24" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-surface" />
            <div className="h-12 w-40 animate-pulse rounded-full bg-surface" />
          </div>
        </div>
        <div className="mt-14 h-8 w-3/4 animate-pulse rounded-full bg-surface md:mt-24 md:w-1/2" />
        <div className="mt-5 grid gap-3 md:grid-cols-3 md:gap-4">
          <div className={`h-[240px] ${block}`} />
          <div className={`hidden h-[240px] md:block ${block}`} />
          <div className={`hidden h-[240px] md:block ${block}`} />
        </div>
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
