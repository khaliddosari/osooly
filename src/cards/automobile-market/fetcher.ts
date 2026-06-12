import type { CardServerContext } from "@/lib/cards/server-context";
import { round2 } from "@/lib/format";
import {
  readSnapshots,
  usableReading,
  type PricedReading,
  type SnapshotReading,
} from "@/lib/market-snapshot";
import { slugify } from "../../adapters/scrape-stats";

export interface VehicleValuation {
  assetId: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  purchasePrice: number | null;
  purchaseCurrency: string;
  /** Syarah median (dealer-skewed stock), symbol `<make-model>`. */
  dealer: SnapshotReading | null;
  /** Haraj median (private sellers), symbol `<make-model>:haraj`. */
  privateMarket: SnapshotReading | null;
  /** Mean of the usable source medians; null when both are unusable. */
  estimateSar: number | null;
}

export interface AutoMarketData {
  vehicles: VehicleValuation[];
}

interface AssetRow {
  id: string;
  name: string;
  purchase_price: number | null;
  purchase_currency: string;
  details: string | null;
}

/**
 * Card fetcher (PRD §3.5): joins the user's saved vehicles to the nightly
 * Syarah + Haraj medians in the shared cache. The cron only scrapes saved
 * make/model pairs, so a vehicle added today prices after tonight's run.
 */
export async function fetchAutoMarketData({
  db,
  userId,
}: CardServerContext): Promise<AutoMarketData> {
  const rows = userId
    ? (
        await db
          .prepare(
            `SELECT id, name, purchase_price, purchase_currency, details
             FROM assets
             WHERE user_id = ?1 AND asset_class = 'autos'
             ORDER BY name`
          )
          .bind(userId)
          .all<AssetRow>()
      ).results
    : [];

  const targets = rows.map((row) => ({
    row,
    ...parseVehicleDetails(row.details),
  }));
  const symbols = [
    ...new Set(
      targets.flatMap(({ make, model }) => {
        if (!make || !model) return [];
        const slug = slugify(make, model);
        return [slug, `${slug}:haraj`];
      })
    ),
  ];
  const snapshots =
    symbols.length > 0 ? await readSnapshots(db, "autos", symbols) : [];
  const bySymbol = new Map(snapshots.map((s) => [s.symbol, s]));

  const vehicles: VehicleValuation[] = targets.map(
    ({ row, make, model, year }) => {
      const slug = make && model ? slugify(make, model) : null;
      const dealer = slug ? (bySymbol.get(slug) ?? null) : null;
      const privateMarket = slug
        ? (bySymbol.get(`${slug}:haraj`) ?? null)
        : null;
      const usable = [dealer, privateMarket]
        .map(usableReading)
        .filter((r): r is PricedReading => r !== null);

      return {
        assetId: row.id,
        name: row.name,
        make,
        model,
        year,
        purchasePrice: row.purchase_price,
        purchaseCurrency: row.purchase_currency,
        dealer,
        privateMarket,
        estimateSar:
          usable.length > 0
            ? round2(
                usable.reduce((sum, r) => sum + r.price, 0) / usable.length
              )
            : null,
      };
    }
  );

  return { vehicles };
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
    // Malformed details on one vehicle shouldn't hide the rest (same
    // tolerance as workers/cron/autos.ts).
    return { make: null, model: null, year: null };
  }
}
