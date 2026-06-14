import type { AssetClass } from "@/lib/market-snapshot";

/**
 * Test-only fakes for the card fetchers and the S6 agent layer: an
 * in-memory D1 stub that routes the query shapes the app issues
 * (market_snapshot reads, per-user / per-id asset reads, transactions,
 * recommendation insert + latest-N reads) against canned rows. Not
 * imported by app code.
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
  purchased_at?: string | null;
  details?: string | null;
}

export interface FakeTransaction {
  user_id: string;
  asset_id: string;
  kind: string;
  quantity: number;
  price?: number | null;
  currency?: string;
  occurred_at: string;
}

export interface FakeRecommendation {
  id: string;
  user_id: string;
  asset_id: string | null;
  card_id: string;
  action: string;
  reasoning: string;
  confidence: number;
  model: string;
  created_at?: string;
}

export interface FakeUser {
  id: string;
  email?: string | null;
  name?: string | null;
}

export interface FakeAlert {
  id: string;
  user_id: string;
  card_id: string;
  asset_id?: string | null;
  /** Stored as a JSON string in D1; pass the object, the fake serialises it. */
  predicate: Record<string, unknown>;
  channels?: string[];
  enabled?: 0 | 1;
  created_at?: string;
  last_fired_at?: string | null;
}

export interface FakeDbWithStores extends D1Database {
  /** Rows written through INSERT INTO recommendations, oldest first. */
  readonly recommendations: FakeRecommendation[];
  /** Live alert rows; the evaluator mutates last_fired_at in place. */
  readonly alerts: FakeAlert[];
}

export function fakeDb(rows: {
  snapshots?: FakeSnapshot[];
  assets?: FakeAsset[];
  transactions?: FakeTransaction[];
  recommendations?: FakeRecommendation[];
  alerts?: FakeAlert[];
  users?: FakeUser[];
}): FakeDbWithStores {
  const snapshots = rows.snapshots ?? [];
  const assets = rows.assets ?? [];
  const transactions = rows.transactions ?? [];
  const recommendations = [...(rows.recommendations ?? [])];
  const alerts = (rows.alerts ?? []).map((a) => ({
    channels: [],
    enabled: 1 as 0 | 1,
    asset_id: null,
    last_fired_at: null,
    ...a,
  }));
  const users = rows.users ?? [];

  function fullAsset(a: FakeAsset) {
    return {
      symbol: null,
      quantity: 1,
      unit: null,
      purchase_price: null,
      purchase_currency: "SAR",
      purchased_at: null,
      details: null,
      ...a,
    };
  }

  function route(sql: string, args: unknown[]): unknown[] {
    if (sql.includes("FROM alerts")) {
      const nameById = new Map(assets.map((a) => [a.id, a.name]));
      if (sql.includes("json_extract")) {
        // listFiringAlerts: enabled rows whose predicate watches this class.
        const userById = new Map(users.map((u) => [u.id, u]));
        return alerts
          .filter(
            (a) =>
              a.enabled === 1 &&
              (a.predicate as { assetClass?: string }).assetClass === args[0]
          )
          .map((a) => ({
            id: a.id,
            user_id: a.user_id,
            card_id: a.card_id,
            asset_id: a.asset_id ?? null,
            asset_name: (a.asset_id && nameById.get(a.asset_id)) ?? null,
            user_email: userById.get(a.user_id)?.email ?? null,
            user_name: userById.get(a.user_id)?.name ?? null,
            predicate: JSON.stringify(a.predicate),
            channels: JSON.stringify(a.channels ?? []),
            last_fired_at: a.last_fired_at ?? null,
          }));
      }
      // listAlertsForUser: optionally scoped to one card.
      const [userId, cardId] = args as [string, string?];
      return alerts
        .filter(
          (a) => a.user_id === userId && (cardId === undefined || a.card_id === cardId)
        )
        .map((a) => ({
          id: a.id,
          card_id: a.card_id,
          asset_id: a.asset_id ?? null,
          asset_name: (a.asset_id && nameById.get(a.asset_id)) ?? null,
          predicate: JSON.stringify(a.predicate),
          channels: JSON.stringify(a.channels ?? []),
          enabled: a.enabled ?? 1,
          created_at: a.created_at ?? hoursAgoUtc(0),
          last_fired_at: a.last_fired_at ?? null,
        }));
    }
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
    if (sql.includes("FROM recommendations")) {
      const [userId, cardId, limit] = args as [string, string, number?];
      const nameById = new Map(assets.map((a) => [a.id, a.name]));
      return recommendations
        .filter((r) => r.user_id === userId && r.card_id === cardId)
        .slice()
        .reverse() // insertion order stands in for created_at DESC, rowid DESC
        .slice(0, limit ?? 3)
        .map((r) => ({
          id: r.id,
          asset_id: r.asset_id,
          asset_name: (r.asset_id && nameById.get(r.asset_id)) ?? null,
          action: r.action,
          reasoning: r.reasoning,
          confidence: r.confidence,
          model: r.model,
          created_at: r.created_at ?? hoursAgoUtc(0),
        }));
    }
    if (sql.includes("FROM transactions")) {
      return transactions
        .filter((t) => t.user_id === args[0])
        .map((t) => ({ price: null, currency: "SAR", ...t }))
        .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    }
    if (sql.includes("FROM assets")) {
      const assetClass = /asset_class = '([a-z_]+)'/.exec(sql)?.[1];
      if (sql.includes("WHERE id = ?")) {
        // Tool reads: by asset id, scoped to user (+ class when present).
        const [id, userId] = args as [string, string];
        return assets
          .filter(
            (a) =>
              a.id === id &&
              a.user_id === userId &&
              (!assetClass || a.asset_class === assetClass)
          )
          .map(fullAsset);
      }
      return assets
        .filter(
          (a) =>
            a.user_id === args[0] &&
            (!assetClass || a.asset_class === assetClass)
        )
        .map(fullAsset)
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    throw new Error(`fakeDb: unrouted query: ${sql}`);
  }

  function execute(sql: string, args: unknown[]): unknown[] {
    if (sql.startsWith("INSERT INTO recommendations")) {
      const [
        id,
        user_id,
        asset_id,
        card_id,
        action,
        reasoning,
        confidence,
        model,
      ] = args as [
        string,
        string,
        string | null,
        string,
        string,
        string,
        number,
        string,
      ];
      recommendations.push({
        id,
        user_id,
        asset_id,
        card_id,
        action,
        reasoning,
        confidence,
        model,
        created_at: hoursAgoUtc(0),
      });
      return [];
    }
    if (sql.startsWith("UPDATE alerts SET last_fired_at")) {
      const [id, firedAt] = args as [string, string];
      const row = alerts.find((a) => a.id === id);
      if (row) row.last_fired_at = firedAt;
      return [];
    }
    if (sql.startsWith("UPDATE alerts SET enabled")) {
      const [id, userId, enabled] = args as [string, string, number];
      const row = alerts.find((a) => a.id === id && a.user_id === userId);
      if (row) row.enabled = enabled ? 1 : 0;
      return [];
    }
    if (sql.startsWith("DELETE FROM alerts")) {
      const [id, userId] = args as [string, string];
      const idx = alerts.findIndex((a) => a.id === id && a.user_id === userId);
      if (idx >= 0) alerts.splice(idx, 1);
      return [];
    }
    if (sql.startsWith("INSERT INTO alerts")) {
      const [id, user_id, card_id, asset_id, predicate, channels] = args as [
        string,
        string,
        string,
        string | null,
        string,
        string,
      ];
      alerts.push({
        id,
        user_id,
        card_id,
        asset_id,
        predicate: JSON.parse(predicate),
        channels: JSON.parse(channels),
        enabled: 1,
        created_at: hoursAgoUtc(0),
        last_fired_at: null,
      });
      return [];
    }
    return route(sql, args);
  }

  const db = {
    recommendations,
    alerts,
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        all: async <T>() => ({ results: execute(sql, args) as T[] }),
        first: async <T>() => ((execute(sql, args)[0] as T) ?? null),
        run: async () => {
          execute(sql, args);
          return { success: true };
        },
      }),
    }),
    batch: async (statements: { run: () => Promise<unknown> }[]) =>
      Promise.all(statements.map((stmt) => stmt.run())),
  };
  return db as unknown as FakeDbWithStores;
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
