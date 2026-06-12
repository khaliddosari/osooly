import type { CardServerContext } from "@/lib/cards/server-context";
import { readSnapshots, type SnapshotReading } from "@/lib/market-snapshot";
import { slugify } from "../../adapters/scrape-stats";

/** Aqar rows share the city slug with REGA rows, suffixed per source. */
const AQAR_SUFFIX = ":aqar";

export interface CityMarket {
  /** Display name: the user's spelling, else Aqar's, else the slug. */
  city: string;
  slug: string;
  /** Official REGA/MoJ transaction index for the city. */
  index: SnapshotReading | null;
  /** Aqar live asking-price median for the city. */
  comparables: SnapshotReading | null;
}

export interface PropertySummary {
  assetId: string;
  name: string;
  city: string | null;
  purchasePrice: number | null;
  purchaseCurrency: string;
}

export interface RealEstateMarketData {
  cities: CityMarket[];
  properties: PropertySummary[];
}

interface AssetRow {
  id: string;
  name: string;
  purchase_price: number | null;
  purchase_currency: string;
  details: string | null;
}

/**
 * Card fetcher (PRD §3.5): city-level REGA index + Aqar comparables from the
 * shared cache, scoped to the cities the user holds property in. With no
 * properties yet, every city the platform tracks is shown instead so the
 * card still reads as a market card.
 */
export async function fetchRealEstateMarketData({
  db,
  userId,
}: CardServerContext): Promise<RealEstateMarketData> {
  const snapshots = await readSnapshots(db, "real_estate");
  const indexBySlug = new Map<string, SnapshotReading>();
  const aqarBySlug = new Map<string, SnapshotReading>();
  for (const snapshot of snapshots) {
    if (snapshot.symbol.endsWith(AQAR_SUFFIX)) {
      aqarBySlug.set(snapshot.symbol.slice(0, -AQAR_SUFFIX.length), snapshot);
    } else {
      indexBySlug.set(snapshot.symbol, snapshot);
    }
  }

  const rows = userId
    ? (
        await db
          .prepare(
            `SELECT id, name, purchase_price, purchase_currency, details
             FROM assets
             WHERE user_id = ?1 AND asset_class = 'real_estate'
             ORDER BY name`
          )
          .bind(userId)
          .all<AssetRow>()
      ).results
    : [];

  const properties: PropertySummary[] = rows.map((row) => ({
    assetId: row.id,
    name: row.name,
    city: parseCity(row.details),
    purchasePrice: row.purchase_price,
    purchaseCurrency: row.purchase_currency,
  }));

  const citySlugs = new Map<string, string>();
  for (const property of properties) {
    if (property.city) citySlugs.set(slugify(property.city), property.city);
  }
  if (citySlugs.size === 0) {
    const tracked = [
      ...new Set([...indexBySlug.keys(), ...aqarBySlug.keys()]),
    ].sort();
    for (const slug of tracked) {
      const fromAqar = aqarBySlug.get(slug)?.payload?.city;
      citySlugs.set(
        slug,
        typeof fromAqar === "string" ? fromAqar : titleCase(slug)
      );
    }
  }

  return {
    cities: [...citySlugs].map(([slug, city]) => ({
      city,
      slug,
      index: indexBySlug.get(slug) ?? null,
      comparables: aqarBySlug.get(slug) ?? null,
    })),
    properties,
  };
}

function parseCity(details: string | null): string | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as { city?: unknown };
    return String(parsed.city ?? "").trim() || null;
  } catch {
    // Malformed details on one property shouldn't hide the rest (same
    // tolerance as workers/cron/realestate.ts).
    return null;
  }
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
