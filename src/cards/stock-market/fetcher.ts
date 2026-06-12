import type { CardServerContext } from "@/lib/cards/server-context";
import { readSnapshots, type SnapshotReading } from "@/lib/market-snapshot";

/** The index headline every user sees, holdings or not (PRD §3.5). */
export const TASI_SYMBOL = "TASI";

export interface StockHolding {
  assetId: string;
  name: string;
  symbol: string | null;
  quantity: number;
  purchasePrice: number | null;
  purchaseCurrency: string;
  /** Latest shared-cache quote; null when the symbol has never refreshed. */
  snapshot: SnapshotReading | null;
}

export interface StockMarketData {
  index: SnapshotReading | null;
  holdings: StockHolding[];
}

interface AssetRow {
  id: string;
  name: string;
  symbol: string | null;
  quantity: number;
  purchase_price: number | null;
  purchase_currency: string;
}

/**
 * Card fetcher (PRD §3.5): joins the user's stock holdings to the shared
 * market_snapshot cache. Reads only D1, never a provider API; the stocks
 * cron is the sole writer (PRD §3.5a rule 1).
 */
export async function fetchStockMarketData({
  db,
  userId,
}: CardServerContext): Promise<StockMarketData> {
  const holdings = userId
    ? (
        await db
          .prepare(
            `SELECT id, name, symbol, quantity, purchase_price, purchase_currency
             FROM assets
             WHERE user_id = ?1 AND asset_class = 'stocks'
             ORDER BY name`
          )
          .bind(userId)
          .all<AssetRow>()
      ).results
    : [];

  const symbols = [
    ...new Set([
      TASI_SYMBOL,
      ...holdings
        .map((row) => row.symbol)
        .filter((symbol): symbol is string => Boolean(symbol)),
    ]),
  ];
  const snapshots = await readSnapshots(db, "stocks", symbols);
  const bySymbol = new Map(snapshots.map((s) => [s.symbol, s]));

  return {
    index: bySymbol.get(TASI_SYMBOL) ?? null,
    holdings: holdings.map((row) => ({
      assetId: row.id,
      name: row.name,
      symbol: row.symbol,
      quantity: row.quantity,
      purchasePrice: row.purchase_price,
      purchaseCurrency: row.purchase_currency,
      snapshot: (row.symbol && bySymbol.get(row.symbol)) || null,
    })),
  };
}
