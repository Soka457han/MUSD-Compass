import Link from "next/link";
import { CompassMark, TabIcon } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Yields" },
  { href: "/vault", label: "Vault" },
  { href: "/rewards", label: "Rewards" },
  { href: "/trove", label: "Trove" },
  { href: "/developers", label: "API" },
];

/** Top bar everywhere; on phones the page links move to a bottom tab bar within thumb reach. */
export function SiteHeader({ current }: { current: string }) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:h-[72px] md:gap-8 md:px-6">
          <Link href="/" className="flex flex-1 items-center gap-2.5 text-[17px] font-bold whitespace-nowrap no-underline md:flex-none md:text-lg">
            <CompassMark className="size-7" />
            MUSD Compass
          </Link>
          <nav aria-label="Main" className="hidden flex-1 md:block">
            <ul className="flex gap-1 text-[15px] font-semibold">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    prefetch={false}
                    aria-current={current === n.href ? "page" : undefined}
                    className="inline-flex h-10 items-center rounded-full px-4 text-ink-muted no-underline hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
          <Link href="/vault" prefetch={false} className="inline-flex h-11 items-center rounded-full bg-accent px-[18px] text-[15px] font-bold text-on-accent no-underline md:px-[22px]">
            Open vault
          </Link>
        </div>
      </header>
      <nav aria-label="Main" className="tabbar fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[max(10px,env(safe-area-inset-bottom))] md:hidden">
        <ul className="grid grid-cols-5 px-2 pt-2">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                prefetch={false}
                aria-current={current === n.href ? "page" : undefined}
                className="group flex min-h-12 flex-col items-center gap-0.5 text-xs font-semibold text-ink-muted no-underline aria-[current=page]:text-ink"
              >
                <span className="flex h-7 w-12 items-center justify-center rounded-full group-aria-[current=page]:bg-accent-soft">
                  <TabIcon href={n.href} className="size-[18px]" />
                </span>
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
