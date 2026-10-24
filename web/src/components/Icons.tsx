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
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M15.5 8.5 13.4 13.4 8.5 15.5l2.1-4.9z" fill="currentColor" />
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
