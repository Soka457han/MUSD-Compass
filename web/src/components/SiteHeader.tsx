import Link from "next/link";
import { CompassMark, TabIcon } from "./Icons";
import { ThemeToggle } from "./ThemeToggle";

const BOT = process.env.NEXT_PUBLIC_BOT_URL ?? "https://t.me/musd_compass_bot";
const NAV = [
  { href: "/", label: "Yields", icon: "/" },
  { href: "/vault", label: "Vault", icon: "/vault" },
  { href: "/rewards", label: "Rewards", icon: "/rewards" },
  { href: "/trove", label: "Trove", icon: "/trove" },
  { href: "/developers", label: "API", icon: "/developers" },
  { href: BOT, label: "Bot", icon: "bot" },
];

type Item = (typeof NAV)[number];

/** One nav link. The bot link goes to Telegram; the page you are on scrolls to the top instead of being fetched again. */
function NavLink({ n, current, className, children }: { n: Item; current: string; className: string; children: React.ReactNode }) {
  if (!n.href.startsWith("/"))
    return (
      <a href={n.href} className={className}>
        {children}
      </a>
    );
  const here = current === n.href;
  return (
    // A plain anchor for "you are here": a Next Link to the same URL would ask the server for the page again.
    here ? (
      <a href="#" aria-current="page" className={className}>
        {children}
      </a>
    ) : (
      <Link href={n.href} prefetch={false} className={className}>
        {children}
      </Link>
    )
  );
}

/** Top bar everywhere; on phones the links move to a bottom tab bar within thumb reach. */
export function SiteHeader({ current }: { current: string }) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:h-[72px] md:gap-8 md:px-6">
          <Link href="/" className="flex flex-1 items-center gap-2.5 text-[17px] font-bold whitespace-nowrap no-underline md:text-lg lg:flex-none">
            <CompassMark className="size-7" />
            MUSD Compass
          </Link>
          <nav aria-label="Main" className="hidden flex-1 lg:block">
            <ul className="flex gap-1 text-[15px] font-semibold">
              {NAV.map((n) => (
                <li key={n.label}>
                  <NavLink
                    n={n}
                    current={current}
                    className="inline-flex h-10 items-center rounded-full px-4 text-ink-muted no-underline hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink"
                  >
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
          <Link href="/vault" prefetch={false} className="hidden h-11 items-center rounded-full bg-accent px-[18px] text-[15px] font-bold whitespace-nowrap text-on-accent no-underline min-[400px]:inline-flex md:px-[22px]">
            Open vault
          </Link>
        </div>
      </header>
      <nav aria-label="Main" className="tabbar fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[max(10px,env(safe-area-inset-bottom))] lg:hidden">
        <ul className="grid grid-cols-6 px-1 pt-2">
          {NAV.map((n) => (
            <li key={n.label}>
              <NavLink
                n={n}
                current={current}
                className="group flex min-h-12 flex-col items-center gap-0.5 text-xs font-semibold text-ink-muted no-underline aria-[current=page]:text-ink"
              >
                <span className="flex h-7 w-11 items-center justify-center rounded-full group-aria-[current=page]:bg-accent-soft">
                  <TabIcon name={n.icon} className="size-[18px]" />
                </span>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
