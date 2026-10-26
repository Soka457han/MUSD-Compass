export function pct(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const s = Math.abs(n).toFixed(digits);
  return `${n < 0 && Number(s) !== 0 ? "−" : ""}${s}%`; // −0.004 rounds to 0.00%, not −0.00%
}

// minimumFractionDigits is explicit: Node and Chromium default it differently for compact currency
// ("$77.0K" vs "$77K"), which broke hydration of the home page.
export function usd(n: number | null): string {
  if (n === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", minimumFractionDigits: n < 10 ? 2 : 0, maximumFractionDigits: n < 10 ? 2 : n < 1000 ? 0 : 1 }).format(n);
}

export function musd(n: number): string {
  return `${new Intl.NumberFormat("en-US", { notation: n >= 100_000 ? "compact" : "standard", maximumFractionDigits: n >= 100_000 ? 0 : 0 }).format(n)} MUSD`;
}

export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));
}

export function timeUtc(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(iso)) + " UTC";
}
