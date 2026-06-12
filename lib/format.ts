/**
 * Display helpers shared by the v1 cards. Money renders as number + ISO code
 * ("245,000 SAR"), matching the design system's preference for codes over
 * currency symbols on the dark dashboard.
 */

export function formatMoney(
  value: number,
  currency = "SAR",
  fractionDigits?: number
): string {
  const digits = fractionDigits ?? (Math.abs(value) >= 1000 ? 0 : 2);
  const amount = value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${amount} ${currency}`;
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
