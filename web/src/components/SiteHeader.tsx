import Link from "next/link";
import { CompassMark } from "./Icons";

// The bot link appears once its public t.me URL is configured (NEXT_PUBLIC_BOT_URL).
const BOT = process.env.NEXT_PUBLIC_BOT_URL;
const NAV = [
  { href: "/", label: "Yields" },
  { href: "/vault", label: "Vault" },
  ...(BOT ? [{ href: BOT, label: "Bot" }] : []),
  { href: "/api/yields", label: "API" },
];

const ITEM =
  "inline-flex min-h-11 items-center rounded px-2 hover:underline aria-[current=page]:bg-on-yellow aria-[current=page]:text-yellow";

export function SiteHeader({ current }: { current: string }) {
  return (
    <header className="bg-yellow text-on-yellow">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight no-underline">
          <CompassMark className="size-6" />
          <span className="text-base whitespace-nowrap sm:text-lg" style={{ fontStretch: "88%" }}>MUSD Compass</span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-0.5 text-sm font-semibold">
            {NAV.map((n) => (
              <li key={n.href}>
                {!n.href.startsWith("/") || n.href.startsWith("/api") ? (
                  <a href={n.href} className={ITEM}>
                    {n.label}
                  </a>
                ) : (
                  <Link href={n.href} aria-current={current === n.href ? "page" : undefined} className={ITEM}>
                    {n.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
