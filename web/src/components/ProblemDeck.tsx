"use client";

import { useRef, useState } from "react";

const CARDS = (count: number) => [
  {
    big: String(count),
    title: "Places to earn, each with its own APR",
    body: "MUSD earns in the Savings Vault, the Stability Pool, six Mezo pools and Mezo-paid pools on Ethereum. None of them use the same yardstick.",
    bg: "bg-tile-yellow",
  },
  {
    big: "12 weeks",
    title: "Part of the yield is locked",
    body: "Several pools pay in veMEZO, which stays locked for 12 weeks. A large APR can be mostly lock and very little cash.",
    bg: "bg-tile-pink",
  },
  {
    big: "Gas",
    title: "Costs eat small amounts",
    body: "Going to Ethereum costs a bridge and gas both ways. Borrowed MUSD carries trove interest. On a small deposit that can cancel the yield.",
    bg: "bg-tile-peach",
  },
];

/** Phones: a stacked hand that spreads into a swipe row on tap. From md up the CSS lays it out as a 3-column grid. */
export function ProblemDeck({ count }: { count: number }) {
  const [spread, setSpread] = useState(false);
  const deck = useRef<HTMLDivElement>(null);
  // The button goes away once spread, so focus moves to the row (scrollable with the arrow keys) instead of falling to the page.
  const open = (moveFocus: boolean) => {
    setSpread(true);
    if (moveFocus) deck.current?.focus();
  };
  return (
    <section aria-labelledby="problem-h">
      <h2 id="problem-h" className="px-4 text-2xl leading-tight font-extrabold tracking-tight md:px-0 md:text-[32px]">
        Why picking a spot for MUSD is hard
      </h2>
      <div
        ref={deck}
        className="deck mt-4 md:mt-6"
        data-spread={spread || undefined}
        onClick={() => open(false)}
        tabIndex={spread ? 0 : -1}
        role="region"
        aria-label="Problem cards"
      >
        <div className="deck-track">
          {CARDS(count).map((c) => (
            <article key={c.title} className={`deck-card flex flex-col gap-2 rounded-[18px] p-[22px] text-tile-ink md:rounded-[20px] md:p-7 ${c.bg}`}>
              <span className="deck-big price text-[38px] md:text-5xl">{c.big}</span>
              <div className="deck-more flex flex-col gap-2">
                <h3 className="mt-1.5 text-[17px] font-bold md:text-xl">{c.title}</h3>
                <p className="text-sm text-tile-ink-muted md:text-base">{c.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="mt-2 flex min-h-11 items-center justify-between gap-3 px-4 md:hidden">
        <p className="text-[13px] text-ink-muted">{spread ? "Swipe for more" : "Tap the cards to spread them out"}</p>
        {!spread && (
          <button type="button" onClick={() => open(true)} className="min-h-11 rounded-full border border-line px-[18px] text-sm font-semibold">
            Spread out
          </button>
        )}
      </div>
    </section>
  );
}
