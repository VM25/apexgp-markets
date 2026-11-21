/** Formatting helpers. Money is carried in integer cents throughout the engine. */

export function usd(cents: number, opts: { sign?: boolean; decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 2;
  const abs = Math.abs(cents) / 100;
  const text = abs.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const neg = cents < -0.5 / 10 ** decimals;
  const prefix = neg ? "−" : opts.sign && cents > 0 ? "+" : "";
  return `${prefix}$${text}`;
}

export function usdCompact(cents: number): string {
  const v = cents / 100;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 10_000) return `$${(v / 1000).toFixed(1)}k`;
  return usd(cents, { decimals: 0 });
}

/** Probability as a percentage with sensible precision at the extremes. */
export function pct(p: number, digits = 1): string {
  if (!Number.isFinite(p)) return "—";
  const v = p * 100;
  if (v > 0 && v < 0.1) return "<0.1%";
  if (v < 100 && v > 99.9) return ">99.9%";
  return `${v.toFixed(v >= 10 || digits === 0 ? Math.min(digits, 1) : digits)}%`;
}

export function cents(price: number | null | undefined, digits = 0): string {
  if (price === null || price === undefined || !Number.isFinite(price)) return "—";
  return `${price.toFixed(digits)}¢`;
}

export function qty(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function signedPct(x: number, digits = 2): string {
  const v = x * 100;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
}

export function gapText(seconds: number, lapsDown: number): string {
  if (lapsDown > 0) return `+${lapsDown} lap${lapsDown > 1 ? "s" : ""}`;
  if (seconds <= 0) return "Leader";
  return `+${seconds.toFixed(seconds < 100 ? 1 : 0)}s`;
}

export function dateShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export const tone = (x: number) => (x > 0.5 ? "gain" : x < -0.5 ? "loss" : "");

export function teamColor(color: string | null | undefined): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#5c6068";
}
