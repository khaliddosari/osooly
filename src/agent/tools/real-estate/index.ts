import { readSnapshots } from "@/lib/market-snapshot";
import { slugify } from "@/src/adapters/scrape-stats";
import { summarizeReading, type ReadingSummary, type ToolImpl } from "../types";

/**
 * Real-estate tools (PRD §3.6): the real-estate sub-agent's read surface
 * over the nightly REGA transaction index + Aqar comparables in the shared
 * cache. The AutoML-backed projection lives in src/agent/tools/automl/
 * (run_automl, PRD §3.7) since S8.
 */

/** Aqar rows share the city slug with REGA rows, suffixed per source. */
const AQAR_SUFFIX = ":aqar";

export interface CityPriceIndexResult {
  city: string;
  slug: string;
  /** Official REGA/MoJ transaction index for the city. */
  index: ReadingSummary | null;
  /** Aqar live asking-price median for the city. */
  comparables: ReadingSummary | null;
}

export const getCityPriceIndex: ToolImpl<
  { city: string },
  CityPriceIndexResult
> = {
  name: "get_city_price_index",
  description:
    "Read the latest cached REGA transaction index and Aqar asking-price median for a city from the shared market snapshot.",
  inputSchema: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name, e.g. Riyadh" },
    },
    required: ["city"],
  },
  async run({ db }, input) {
    const city = String(input.city ?? "").trim();
    const slug = city ? slugify(city) : "";
    const readings = await readCityReadings(db, slug);
    return { city, slug, ...readings };
  },
};

export interface PropertyValueResult {
  found: boolean;
  assetId: string;
  name: string | null;
  city: string | null;
  purchasePrice: number | null;
  purchaseCurrency: string | null;
  purchasedAt: string | null;
  index: ReadingSummary | null;
  comparables: ReadingSummary | null;
}

export const estimatePropertyValue: ToolImpl<
  { assetId: string },
  PropertyValueResult
> = {
  name: "estimate_property_value",
  description:
    "Estimate a saved property's current value from the city's REGA index trend and live comparables, flagging neighborhood-level shifts.",
  inputSchema: {
    type: "object",
    properties: {
      assetId: { type: "string", description: "assets.id of the property" },
    },
    required: ["assetId"],
  },
  async run({ db, userId }, input) {
    const assetId = String(input.assetId ?? "").trim();
    const row = userId
      ? await db
          .prepare(
            `SELECT id, name, purchase_price, purchase_currency, purchased_at, details
             FROM assets
             WHERE id = ?1 AND user_id = ?2 AND asset_class = 'real_estate'`
          )
          .bind(assetId, userId)
          .first<{
            id: string;
            name: string;
            purchase_price: number | null;
            purchase_currency: string;
            purchased_at: string | null;
            details: string | null;
          }>()
      : null;
    if (!row) {
      return {
        found: false,
        assetId,
        name: null,
        city: null,
        purchasePrice: null,
        purchaseCurrency: null,
        purchasedAt: null,
        index: null,
        comparables: null,
      };
    }

    const city = parseCity(row.details);
    const readings = city
      ? await readCityReadings(db, slugify(city))
      : { index: null, comparables: null };

    return {
      found: true,
      assetId,
      name: row.name,
      city,
      purchasePrice: row.purchase_price,
      purchaseCurrency: row.purchase_currency,
      purchasedAt: row.purchased_at,
      ...readings,
    };
  },
};

async function readCityReadings(
  db: D1Database,
  slug: string
): Promise<{ index: ReadingSummary | null; comparables: ReadingSummary | null }> {
  if (!slug) return { index: null, comparables: null };
  const snapshots = await readSnapshots(db, "real_estate", [
    slug,
    `${slug}${AQAR_SUFFIX}`,
  ]);
  const bySymbol = new Map(snapshots.map((s) => [s.symbol, s]));
  return {
    index: summarizeReading(bySymbol.get(slug)),
    comparables: summarizeReading(bySymbol.get(`${slug}${AQAR_SUFFIX}`)),
  };
}

function parseCity(details: string | null): string | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as { city?: unknown };
    return String(parsed.city ?? "").trim() || null;
  } catch {
    return null;
  }
}

export const realEstateToolImpls = [
  getCityPriceIndex,
  estimatePropertyValue,
] as const;
