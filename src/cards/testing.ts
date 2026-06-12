import type { AssetClass } from "@/lib/market-snapshot";

/**
 * Test-only fakes for the card fetchers: an in-memory D1 stub that routes
 * the two query shapes the fetchers issue (market_snapshot reads through
 * readSnapshots(), per-user asset reads) against canned rows. Not imported
 * by app code.
 */

export interface FakeSnapshot {
  assetClass: AssetClass;
  symbol: string;
  price: number | null;
  currency?: string;
  payload?: Record<string, unknown>;
  source?: string;
  /** SQLite UTC "YYYY-MM-DD HH:MM:SS"; defaults to a minute ago (fresh). */
  fetchedAt?: string;
}

export interface FakeAsset {
  id: string;
  user_id: string;
  asset_class: AssetClass;
  name: string;
  symbol?: string | null;
  quantity?: number;
  unit?: string | null;
  purchase_price?: number | null;
  purchase_currency?: string;
  details?: string | null;
}

export function fakeDb(rows: {
  snapshots?: FakeSnapshot[];
  assets?: FakeAsset[];
}): D1Database {
  const snapshots = rows.snapshots ?? [];
  const assets = rows.assets ?? [];

  function route(sql: string, args: unknown[]): unknown[] {
    if (sql.includes("FROM market_snapshot")) {
      const wanted = sql.includes("symbol IN")
        ? new Set(args.slice(1) as string[])
        : null;
      return snapshots
        .filter(
          (s) => s.assetClass === args[0] && (!wanted || wanted.has(s.symbol))
        )
        .map((s) => ({
          asset_class: s.assetClass,
          symbol: s.symbol,
          price: s.price,
          currency: s.currency ?? "SAR",
          payload: s.payload ? JSON.stringify(s.payload) : null,
          source: s.source ?? "test",
          fetched_at: s.fetchedAt ?? hoursAgoUtc(1 / 60),
        }));
    }
    if (sql.includes("FROM assets")) {
      const assetClass = /asset_class = '([a-z_]+)'/.exec(sql)?.[1];
      return assets
        .filter((a) => a.user_id === args[0] && a.asset_class === assetClass)
        .map((a) => ({
          symbol: null,
          quantity: 1,
          unit: null,
          purchase_price: null,
          purchase_currency: "SAR",
          details: null,
          ...a,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    throw new Error(`fakeDb: unrouted query: ${sql}`);
  }

  const db = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        all: async <T>() => ({ results: route(sql, args) as T[] }),
      }),
    }),
  };
  return db as unknown as D1Database;
}

/** N hours ago in SQLite's UTC "YYYY-MM-DD HH:MM:SS" shape. */
export function hoursAgoUtc(hours: number): string {
  return new Date(Date.now() - hours * 36e5)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

/** Far past: derives as "unavailable" for every asset class. */
export const ANCIENT_UTC = "2020-01-01 00:00:00";
