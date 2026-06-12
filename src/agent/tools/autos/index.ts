import { round2 } from "@/lib/format";
import {
  readSnapshots,
  usableReading,
  type PricedReading,
} from "@/lib/market-snapshot";
import { slugify } from "@/src/adapters/scrape-stats";
import { summarizeReading, type ReadingSummary, type ToolImpl } from "../types";

/**
 * Autos tools (PRD §3.6): the autos sub-agent's read surface over the
 * nightly Syarah (dealer) + Haraj (private-seller) medians in the shared
 * cache, plus honest cost-basis math against the user's saved vehicles.
 */

export interface VehicleMarketPriceResult {
  make: string;
  model: string;
  /** Syarah median, symbol `<make-model>`. */
  dealer: ReadingSummary | null;
  /** Haraj median, symbol `<make-model>:haraj`. */
  privateMarket: ReadingSummary | null;
  /** Mean of the usable source medians; null when both are unusable. */
  estimateSar: number | null;
}

export const getVehicleMarketPrice: ToolImpl<
  { make: string; model: string },
  VehicleMarketPriceResult
> = {
  name: "get_vehicle_market_price",
  description:
    "Read the latest cached Syarah (dealer) and Haraj (private-seller) listing medians for a make/model from the shared market snapshot.",
  inputSchema: {
    type: "object",
    properties: {
      make: { type: "string", description: "Manufacturer, e.g. Toyota" },
      model: { type: "string", description: "Model, e.g. Land Cruiser" },
    },
    required: ["make", "model"],
  },
  async run({ db }, input) {
    const make = String(input.make ?? "").trim();
    const model = String(input.model ?? "").trim();
    const valuation = await readVehicleValuation(db, make, model);
    return { make, model, ...valuation };
  },
};

export interface VehicleDepreciationResult {
  found: boolean;
  assetId: string;
  name: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  purchasePrice: number | null;
  purchaseCurrency: string | null;
  purchasedAt: string | null;
  dealer: ReadingSummary | null;
  privateMarket: ReadingSummary | null;
  estimateSar: number | null;
  /** (estimate - purchase) / purchase, in percent; null when unknowable. */
  changePct: number | null;
}

export const estimateVehicleDepreciation: ToolImpl<
  { assetId: string },
  VehicleDepreciationResult
> = {
  name: "estimate_vehicle_depreciation",
  description:
    "Compare a saved vehicle's purchase price to its current market estimate and report the depreciation trend, for sell/hold window suggestions.",
  inputSchema: {
    type: "object",
    properties: {
      assetId: { type: "string", description: "assets.id of the vehicle" },
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
             WHERE id = ?1 AND user_id = ?2 AND asset_class = 'autos'`
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
        make: null,
        model: null,
        year: null,
        purchasePrice: null,
        purchaseCurrency: null,
        purchasedAt: null,
        dealer: null,
        privateMarket: null,
        estimateSar: null,
        changePct: null,
      };
    }

    const { make, model, year } = parseVehicleDetails(row.details);
    const valuation =
      make && model
        ? await readVehicleValuation(db, make, model)
        : { dealer: null, privateMarket: null, estimateSar: null };

    const changePct =
      valuation.estimateSar !== null &&
      row.purchase_price !== null &&
      row.purchase_price > 0
        ? round2(
            ((valuation.estimateSar - row.purchase_price) /
              row.purchase_price) *
              100
          )
        : null;

    return {
      found: true,
      assetId,
      name: row.name,
      make,
      model,
      year,
      purchasePrice: row.purchase_price,
      purchaseCurrency: row.purchase_currency,
      purchasedAt: row.purchased_at,
      ...valuation,
      changePct,
    };
  },
};

async function readVehicleValuation(
  db: D1Database,
  make: string,
  model: string
): Promise<{
  dealer: ReadingSummary | null;
  privateMarket: ReadingSummary | null;
  estimateSar: number | null;
}> {
  if (!make || !model) {
    return { dealer: null, privateMarket: null, estimateSar: null };
  }
  const slug = slugify(make, model);
  const snapshots = await readSnapshots(db, "autos", [slug, `${slug}:haraj`]);
  const bySymbol = new Map(snapshots.map((s) => [s.symbol, s]));
  const dealer = bySymbol.get(slug) ?? null;
  const privateMarket = bySymbol.get(`${slug}:haraj`) ?? null;
  const usable = [dealer, privateMarket]
    .map(usableReading)
    .filter((r): r is PricedReading => r !== null);
  return {
    dealer: summarizeReading(dealer),
    privateMarket: summarizeReading(privateMarket),
    estimateSar:
      usable.length > 0
        ? round2(usable.reduce((sum, r) => sum + r.price, 0) / usable.length)
        : null,
  };
}

function parseVehicleDetails(details: string | null): {
  make: string | null;
  model: string | null;
  year: number | null;
} {
  if (!details) return { make: null, model: null, year: null };
  try {
    const parsed = JSON.parse(details) as {
      make?: unknown;
      model?: unknown;
      year?: unknown;
    };
    const make = String(parsed.make ?? "").trim() || null;
    const model = String(parsed.model ?? "").trim() || null;
    const year = Number(parsed.year);
    return { make, model, year: Number.isFinite(year) ? year : null };
  } catch {
    return { make: null, model: null, year: null };
  }
}

export const autoToolImpls = [
  getVehicleMarketPrice,
  estimateVehicleDepreciation,
] as const;
