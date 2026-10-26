// One stroke family: 24px grid, 2px round strokes.
type P = { className?: string; title?: string };
const base = (title?: string) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true }),
});

export function LockIcon({ className, title }: P) {
  return (
    <svg className={className} {...base(title)}>
      <rect x="4" y="10.5" width="16" height="10" rx="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function ArrowUpRightIcon({ className, title }: P) {
  return (
    <svg className={className} {...base(title)}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

export function CompassMark({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--accent)" />
      <path d="M15.5 8.5 13.4 13.4 8.5 15.5l2.1-4.9z" fill="var(--on-accent)" />
    </svg>
  );
}

export function MoonIcon({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="currentColor" />
    </svg>
  );
}

export function SunIcon({ className, title }: P) {
  return (
    <svg className={className} {...base(title)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** Bottom tab bar glyphs, same stroke family. */
export const TAB_ICONS: Record<string, string> = {
  "/": "M4 19V9m6 10V5m6 14v-7m4 7H2",
  "/vault": "M4 7h16v12H4zM8 7V5h8v2",
  "/rewards": "M12 3v3m0 12v3M5 12H2m20 0h-3M7 7 5 5m14 14-2-2M7 17l-2 2M19 5l-2 2",
  "/trove": "M3 21h18M5 21V10l7-6 7 6v11",
  "/developers": "m8 8-5 4 5 4m8-8 5 4-5 4",
  bot: "M21 12a8 8 0 0 1-11.6 7.1L4 20l.9-4.6A8 8 0 1 1 21 12z",
};

export function TabIcon({ name, className }: { name: string; className?: string }) {
  return (
    <svg className={className} {...base()}>
      <path d={TAB_ICONS[name]} />
    </svg>
  );
}

export function ChevronIcon({ className, title }: P) {
  return (
    <svg className={className} {...base(title)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
