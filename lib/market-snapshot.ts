/**
 * The shared market cache (PRD §3.5a rule 1): one market_snapshot row per
 * (asset_class, symbol) the platform tracks. Cron Workers write through
 * upsertSnapshots(); every user's card reads through readSnapshots(). No
 * per-user fetches, ever — that's what keeps free-tier quotas independent
 * of user count.
 *
 * Staleness is *derived* from fetched_at at read time (no flag column):
 * a failed refresh simply leaves the last-known row in place, and the row
 * ages into "stale" and then "unavailable" (PRD §3.5a rules 2–3). This
 * module is imported both by the Next.js app and by workers/cron, so it
 * takes a D1Database handle instead of reaching for a request context.
 */

export type AssetClass = "stocks" | "real_estate" | "autos" | "jewelry";

export interface SnapshotWrite {
  assetClass: AssetClass;
  symbol: string;
  price: number | null;
  currency: string; // ISO code, almost always "SAR"
  payload?: Record<string, unknown>; // provider extras (ohlc, listing counts, …)
  source: string; // adapter id, e.g. "twelve-data"
}

export interface SnapshotRow extends SnapshotWrite {
  fetchedAt: string; // SQLite DATETIME (UTC)
}

export type Freshness = "fresh" | "stale" | "unavailable";

export interface SnapshotReading extends SnapshotRow {
  freshness: Freshness;
  /** Badge copy per PRD §3.5a, e.g. `stale (last updated 3h ago)`. */
  staleLabel: string | null;
  ageMs: number;
}

/**
 * Refresh cadences per PRD §3.6: stocks every minute during market hours,
 * everything else nightly. "Stale" trips at ~2 missed refreshes; the
 * "unavailable" cutoff is the N-consecutive-failures rule expressed in time
 * (PRD §3.5a rule 3) — beyond it, cards fall back to user-entered values.
 */
const FRESHNESS_BUDGET_MS: Record<AssetClass, { staleAfter: number; unavailableAfter: number }> = {
  // Stocks refresh every minute but markets close — don't flag overnight
  // gaps as stale. ~1.5 days marks a missed trading day.
  stocks: { staleAfter: 36e5, unavailableAfter: 36 * 36e5 },
  real_estate: { staleAfter: 48 * 36e5, unavailableAfter: 7 * 24 * 36e5 },
  autos: { staleAfter: 48 * 36e5, unavailableAfter: 7 * 24 * 36e5 },
  jewelry: { staleAfter: 48 * 36e5, unavailableAfter: 7 * 24 * 36e5 },
};

export function deriveFreshness(
  assetClass: AssetClass,
  fetchedAt: string | Date,
  now: Date = new Date()
): { freshness: Freshness; staleLabel: string | null; ageMs: number } {
  const fetched =
    fetchedAt instanceof Date ? fetchedAt : parseSqliteUtc(fetchedAt);
  const ageMs = Math.max(0, now.getTime() - fetched.getTime());
  const budget = FRESHNESS_BUDGET_MS[assetClass];

  if (ageMs >= budget.unavailableAfter) {
    return {
      freshness: "unavailable",
      staleLabel: "market data unavailable, showing user-entered values",
      ageMs,
    };
  }
  if (ageMs >= budget.staleAfter) {
    return {
      freshness: "stale",
      staleLabel: `stale (last updated ${formatAge(ageMs)} ago)`,
      ageMs,
    };
  }
  return { freshness: "fresh", staleLabel: null, ageMs };
}

export function formatAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** SQLite CURRENT_TIMESTAMP is UTC without a zone suffix — pin it. */
function parseSqliteUtc(value: string): Date {
  const normalised = /[zZ]|[+-]\d\d:\d\d$/.test(value)
    ? value
    : `${value.replace(" ", "T")}Z`;
  return new Date(normalised);
}

/* ── D1 access ────────────────────────────────────────────────────────────── */

interface RawRow {
  asset_class: AssetClass;
  symbol: string;
  price: number | null;
  currency: string;
  payload: string | null;
  source: string;
  fetched_at: string;
}

export async function readSnapshots(
  db: D1Database,
  assetClass: AssetClass,
  symbols?: string[],
  now: Date = new Date()
): Promise<SnapshotReading[]> {
  let stmt;
  if (symbols && symbols.length > 0) {
    const placeholders = symbols.map((_, i) => `?${i + 2}`).join(", ");
    stmt = db
      .prepare(
        `SELECT * FROM market_snapshot
         WHERE asset_class = ?1 AND symbol IN (${placeholders})`
      )
      .bind(assetClass, ...symbols);
  } else {
    stmt = db
      .prepare(`SELECT * FROM market_snapshot WHERE asset_class = ?1`)
      .bind(assetClass);
  }
  const { results } = await stmt.all<RawRow>();
  return results.map((row) => ({
    assetClass: row.asset_class,
    symbol: row.symbol,
    price: row.price,
    currency: row.currency,
    payload: row.payload ? JSON.parse(row.payload) : undefined,
    source: row.source,
    fetchedAt: row.fetched_at,
    ...deriveFreshness(row.asset_class, row.fetched_at, now),
  }));
}

/**
 * Write-through for the Cron Workers. Failed symbols simply don't appear in
 * `writes` — their last-known rows stay put and age into staleness.
 */
export async function upsertSnapshots(
  db: D1Database,
  writes: SnapshotWrite[]
): Promise<void> {
  if (writes.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO market_snapshot (asset_class, symbol, price, currency, payload, source, fetched_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)
     ON CONFLICT (asset_class, symbol) DO UPDATE SET
       price = excluded.price,
       currency = excluded.currency,
       payload = excluded.payload,
       source = excluded.source,
       fetched_at = excluded.fetched_at`
  );
  await db.batch(
    writes.map((w) =>
      stmt.bind(
        w.assetClass,
        w.symbol,
        w.price,
        w.currency,
        w.payload ? JSON.stringify(w.payload) : null,
        w.source
      )
    )
  );
}
