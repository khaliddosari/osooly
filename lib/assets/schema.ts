/**
 * The asset-ledger value model (PRD 3.2, the /assets flat ledger in S9): the
 * pure, runtime-only core shared by the API route (validation), the store (D1
 * shape), and the asset-table UI (labels + units). Like lib/alerts/predicates,
 * this stays a leaf: no D1, no server-only, no React, so it is trivially
 * testable and safe to import from both the client table and the route.
 *
 * The four asset classes and the `details` JSON convention come straight from
 * migrations/0001_init.sql; the v1 form edits the flat columns plus a single
 * free-text `note`, which rides in the [PII] `details` blob.
 */

import { asNumber } from "../format";
import type { AssetClass } from "../market-snapshot";

export const ASSET_CLASSES: readonly AssetClass[] = [
  "stocks",
  "real_estate",
  "autos",
  "jewelry",
];

interface AssetClassMeta {
  label: string;
  /** Semantic icon name (components/icon.tsx MAP). */
  icon: string;
  /** Default unit suggestion shown in the form. */
  unitHint: string;
}

export const ASSET_CLASS_META: Record<AssetClass, AssetClassMeta> = {
  stocks: { label: "Stocks", icon: "insights", unitHint: "shares" },
  real_estate: { label: "Real estate", icon: "apartment", unitHint: "sqm" },
  autos: { label: "Automobiles", icon: "directions_car", unitHint: "units" },
  jewelry: { label: "Jewelry", icon: "diamond", unitHint: "grams" },
};

export function assetClassLabel(assetClass: AssetClass): string {
  return ASSET_CLASS_META[assetClass].label;
}

/** The editable shape of one holding (create + update share it). */
export interface AssetInput {
  name: string;
  assetClass: AssetClass;
  symbol: string | null;
  quantity: number;
  unit: string | null;
  purchasePrice: number | null;
  purchaseCurrency: string;
  /** SQLite DATE ('YYYY-MM-DD') or null. */
  purchasedAt: string | null;
  /** Free-text identifiers/notes; persisted in the [PII] details JSON. */
  note: string | null;
}

/** One holding as the owning user sees it in the ledger. */
export interface AssetView extends AssetInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

function cleanString(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, max);
}

function isOneOf<T extends string>(
  candidates: readonly T[],
  value: unknown
): value is T {
  return (
    typeof value === "string" && (candidates as readonly string[]).includes(value)
  );
}

/** A three-letter ISO code, upper-cased; falls back to SAR. Validates the
 * whole string (not a truncation) so "dollars" is rejected, not clipped. */
function parseCurrency(value: unknown): string {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(code) ? code : "SAR";
}

/** SQLite DATE shape guard: 'YYYY-MM-DD' or null. */
function parseDate(value: unknown): string | null {
  const s = cleanString(value, 10);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * Parse and validate an untrusted holding (request body). Returns null when a
 * required field is missing or malformed so the route fails closed rather than
 * writing a half-formed row. `name` and `assetClass` are the only hard
 * requirements; a physical asset legitimately has no symbol, quantity defaults
 * to 1 (matching the assets table default), and price/date are optional.
 */
export function parseAssetInput(raw: unknown): AssetInput | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;

  const name = cleanString(p.name);
  if (name === null || !isOneOf(ASSET_CLASSES, p.assetClass)) return null;

  const quantityRaw = asNumber(p.quantity);
  const quantity =
    quantityRaw !== null && quantityRaw > 0 ? quantityRaw : 1;

  const priceRaw = asNumber(p.purchasePrice);
  const purchasePrice = priceRaw !== null && priceRaw >= 0 ? priceRaw : null;

  return {
    name,
    assetClass: p.assetClass,
    symbol: cleanString(p.symbol, 24),
    quantity,
    unit: cleanString(p.unit, 24),
    purchasePrice,
    purchaseCurrency: parseCurrency(p.purchaseCurrency),
    purchasedAt: parseDate(p.purchasedAt),
    note: cleanString(p.note, 500),
  };
}
