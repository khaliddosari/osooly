/**
 * Display helpers shared by the v1 cards. Currency-aware money rendering
 * (the SAR symbol vs. plain ISO codes) lives in components/money.tsx, since
 * it needs JSX; this just formats the numeral.
 */

export function formatAmount(value: number, fractionDigits?: number): string {
  const digits = fractionDigits ?? (Math.abs(value) >= 1000 ? 0 : 2);
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** Tolerant number read for snapshot `payload` fields (JSON, untyped). */
export function asNumber(value: unknown): number | null {
  const n = typeof value === "string" && value !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
