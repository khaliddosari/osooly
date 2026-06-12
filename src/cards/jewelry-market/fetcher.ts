import type { CardServerContext } from "@/lib/cards/server-context";
import { round2 } from "@/lib/format";
import {
  readSnapshots,
  usableReading,
  type SnapshotReading,
} from "@/lib/market-snapshot";

/** The one symbol the gold cron writes: SAR/gram fine-gold spot. */
export const GOLD_SYMBOL = "XAU";

/** Assume fine gold until the piece's details say otherwise. */
const DEFAULT_KARAT = 24;

export interface JewelryPiece {
  assetId: string;
  name: string;
  /** assets.quantity; jewelry rows are gram-weighted by convention. */
  grams: number;
  karat: number;
  /** grams × (karat/24) × spot; null while the spot is unusable. */
  marketValueSar: number | null;
  purchasePrice: number | null;
  purchaseCurrency: string;
}

export interface JewelryMarketData {
  /** SAR/gram spot reading (gold-api.com × USD→SAR, nightly cron). */
  spot: SnapshotReading | null;
  pieces: JewelryPiece[];
  totalGrams: number;
  /** Spot-repriced inventory total; null when the spot is unusable. */
  totalMarketValueSar: number | null;
  /** Fallback per PRD §3.5a rule 2: sum of user-entered purchase prices. */
  totalPurchaseValue: number;
}

interface AssetRow {
  id: string;
  name: string;
  quantity: number;
  purchase_price: number | null;
  purchase_currency: string;
  details: string | null;
}

/**
 * Card fetcher (PRD §3.5): re-prices the user's gram-weighted inventory at
 * the latest cached SAR/gram spot. Reads only D1; the gold cron is the sole
 * writer (PRD §3.5a rule 1).
 */
export async function fetchJewelryMarketData({
  db,
  userId,
}: CardServerContext): Promise<JewelryMarketData> {
  const [spot] = await readSnapshots(db, "jewelry", [GOLD_SYMBOL]);
  const rows = userId
    ? (
        await db
          .prepare(
            `SELECT id, name, quantity, purchase_price, purchase_currency, details
             FROM assets
             WHERE user_id = ?1 AND asset_class = 'jewelry'
             ORDER BY name`
          )
          .bind(userId)
          .all<AssetRow>()
      ).results
    : [];

  const spotPrice = usableReading(spot)?.price ?? null;

  const pieces: JewelryPiece[] = rows.map((row) => {
    const karat = parseKarat(row.details);
    return {
      assetId: row.id,
      name: row.name,
      grams: row.quantity,
      karat,
      marketValueSar:
        spotPrice !== null
          ? round2(row.quantity * (karat / 24) * spotPrice)
          : null,
      purchasePrice: row.purchase_price,
      purchaseCurrency: row.purchase_currency,
    };
  });

  return {
    spot: spot ?? null,
    pieces,
    totalGrams: round2(pieces.reduce((sum, p) => sum + p.grams, 0)),
    totalMarketValueSar:
      spotPrice !== null
        ? round2(pieces.reduce((sum, p) => sum + (p.marketValueSar ?? 0), 0))
        : null,
    totalPurchaseValue: round2(
      pieces.reduce((sum, p) => sum + (p.purchasePrice ?? 0), 0)
    ),
  };
}

function parseKarat(details: string | null): number {
  if (!details) return DEFAULT_KARAT;
  try {
    const parsed = JSON.parse(details) as { karat?: unknown };
    const karat = Number(parsed.karat);
    if (Number.isFinite(karat) && karat >= 1 && karat <= 24) return karat;
  } catch {
    // Malformed details on one piece shouldn't hide the rest (same
    // tolerance as the cron readers).
  }
  return DEFAULT_KARAT;
}
