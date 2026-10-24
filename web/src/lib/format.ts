export function pct(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const s = Math.abs(n).toFixed(digits);
  return `${n < 0 ? "−" : ""}${s}%`;
}

export function usd(n: number | null): string {
  if (n === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: n < 1000 ? 0 : 1 }).format(n);
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
