/**
 * The alert predicate model (PRD §3.8a): the pure, runtime-only core of the
 * "Notify me when …" feature. Imported by the API route (validation), the
 * card UI (labels), and the alerts-evaluator Cron Worker (matching), so this
 * module stays a leaf — no D1, no LangChain, no server-only imports.
 *
 * A stored predicate is one JSON blob in `alerts.predicate`. The `alerts` row
 * has no symbol column, so the watch target (assetClass + symbol) rides in the
 * blob alongside the comparison (field / op / value / window). The flow itself
 * is unchanged from the PRD: row in D1 → Cron evaluator → single n8n webhook.
 */

import { asNumber } from "../format";
import type { AssetClass } from "../market-snapshot";

export const ASSET_CLASSES: readonly AssetClass[] = [
  "stocks",
  "real_estate",
  "autos",
  "jewelry",
];

/** What a predicate compares. `price` is universal; `percent_change` reads
 * the snapshot's daily move (payload.percentChange) where the adapter sets
 * it (stocks today; others as they grow). */
export const ALERT_FIELDS = ["price", "percent_change"] as const;
export type AlertField = (typeof ALERT_FIELDS)[number];

/** Comparison operators. The UI exposes `gt`/`lt` ("rises above" / "falls
 * below"); the rest round out the contract so a stored rule never fails to
 * evaluate. */
export const ALERT_OPS = ["gt", "gte", "lt", "lte", "eq"] as const;
export type AlertOp = (typeof ALERT_OPS)[number];

/** Optional comparison window. v1 only models the daily move; the field is
 * informational until intraday windows exist. */
export const ALERT_WINDOWS = ["day"] as const;
export type AlertWindow = (typeof ALERT_WINDOWS)[number];

/** Delivery channels the n8n workflow fans out to (PRD §3.8a step 4). Osooly
 * only records the user's choice; the actual integrations live in n8n. */
export const ALERT_CHANNELS = [
  "email",
  "whatsapp",
  "telegram",
  "web_push",
] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export interface AlertPredicate {
  assetClass: AssetClass;
  /** market_snapshot symbol to watch, e.g. "TASI", "XAU", "toyota-land-cruiser". */
  symbol: string;
  field: AlertField;
  op: AlertOp;
  value: number;
  window?: AlertWindow;
}

/** The two numbers a predicate can read from a snapshot reading. */
export interface PredicateReading {
  price: number | null;
  percentChange: number | null;
}

export function observedValue(
  field: AlertField,
  reading: PredicateReading
): number | null {
  return field === "price" ? reading.price : reading.percentChange;
}

export function compareValue(op: AlertOp, observed: number, value: number): boolean {
  switch (op) {
    case "gt":
      return observed > value;
    case "gte":
      return observed >= value;
    case "lt":
      return observed < value;
    case "lte":
      return observed <= value;
    case "eq":
      return observed === value;
  }
}

/**
 * Evaluate a predicate against a reading. `observed` is the value the field
 * resolved to (null when the snapshot can't supply it, e.g. a percent_change
 * rule on a feed that has no daily move) — a null observation never matches.
 */
export function evaluatePredicate(
  predicate: AlertPredicate,
  reading: PredicateReading
): { matches: boolean; observed: number | null } {
  const observed = observedValue(predicate.field, reading);
  if (observed === null) return { matches: false, observed: null };
  return { matches: compareValue(predicate.op, observed, predicate.value), observed };
}

/* ── Validation (API route) ──────────────────────────────────────────────── */

function isOneOf<T extends string>(
  candidates: readonly T[],
  value: unknown
): value is T {
  return typeof value === "string" && (candidates as readonly string[]).includes(value);
}

/**
 * Parse and validate an untrusted predicate (request body or stored blob).
 * Returns null on any malformed field so callers fail closed rather than
 * persisting or evaluating a half-formed rule.
 */
export function parsePredicate(raw: unknown): AlertPredicate | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;

  const symbol = typeof p.symbol === "string" ? p.symbol.trim() : "";
  const value = asNumber(p.value);
  if (
    !isOneOf(ASSET_CLASSES, p.assetClass) ||
    symbol === "" ||
    !isOneOf(ALERT_FIELDS, p.field) ||
    !isOneOf(ALERT_OPS, p.op) ||
    value === null
  ) {
    return null;
  }
  if (p.window !== undefined && !isOneOf(ALERT_WINDOWS, p.window)) return null;

  return {
    assetClass: p.assetClass,
    symbol,
    field: p.field,
    op: p.op,
    value,
    ...(p.window ? { window: p.window } : {}),
  };
}

/** Validate a channel list: a non-empty, deduped subset of ALERT_CHANNELS. */
export function parseChannels(raw: unknown): AlertChannel[] | null {
  if (!Array.isArray(raw)) return null;
  const channels = [...new Set(raw)].filter((c): c is AlertChannel =>
    isOneOf(ALERT_CHANNELS, c)
  );
  return channels.length > 0 ? channels : null;
}

/* ── Display ─────────────────────────────────────────────────────────────── */

const OP_LABELS: Record<AlertOp, string> = {
  gt: "rises above",
  gte: "is at or above",
  lt: "falls below",
  lte: "is at or below",
  eq: "equals",
};

/** Human-readable rule, e.g. "Price rises above 200 SAR" or "Daily change
 * falls below -5%". Used by the card list and as the n8n message fallback. */
export function formatPredicate(
  predicate: AlertPredicate,
  currency = "SAR"
): string {
  const subject = predicate.field === "price" ? "Price" : "Daily change";
  const unit = predicate.field === "price" ? ` ${currency}` : "%";
  return `${subject} ${OP_LABELS[predicate.op]} ${predicate.value}${unit}`;
}
