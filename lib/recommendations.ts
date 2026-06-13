/**
 * The recommendation surface (PRD §3.6): structured rows in D1, written by
 * the S6 orchestrator's persist node and read back by every card's fetcher.
 * Imported by card code (client-bundled like the fetchers), so this module
 * stays free of server-only and LangChain imports; it only ever touches the
 * D1 handle it is given.
 */

export type RecommendationAction = "buy" | "sell" | "hold" | "watch";

export const RECOMMENDATION_ACTIONS: readonly RecommendationAction[] = [
  "buy",
  "sell",
  "hold",
  "watch",
];

/** A row the orchestrator wants persisted; id/created_at are filled on write. */
export interface NewRecommendation {
  userId: string;
  assetId: string | null;
  cardId: string;
  action: RecommendationAction;
  reasoning: string;
  confidence: number;
  /** Provider-qualified model id, e.g. "deepseek/deepseek-v4-flash". */
  model: string;
}

/** What cards render (PRD §3.6: the latest N per asset class). */
export interface RecommendationView {
  id: string;
  assetId: string | null;
  /** Joined from assets at read time; null for class-level calls. */
  assetName: string | null;
  action: RecommendationAction;
  reasoning: string;
  confidence: number;
  model: string;
  createdAt: string; // SQLite DATETIME (UTC)
}

export async function insertRecommendations(
  db: D1Database,
  rows: NewRecommendation[]
): Promise<number> {
  if (rows.length === 0) return 0;
  const stmt = db.prepare(
    `INSERT INTO recommendations
       (id, user_id, asset_id, card_id, action, reasoning, confidence, model)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  );
  await db.batch(
    rows.map((row) =>
      stmt.bind(
        crypto.randomUUID(),
        row.userId,
        row.assetId,
        row.cardId,
        row.action,
        row.reasoning,
        row.confidence,
        row.model
      )
    )
  );
  return rows.length;
}

interface RawRecommendationRow {
  id: string;
  asset_id: string | null;
  asset_name: string | null;
  action: RecommendationAction;
  reasoning: string;
  confidence: number;
  model: string;
  created_at: string;
}

export async function readLatestRecommendations(
  db: D1Database,
  userId: string,
  cardId: string,
  limit = 3
): Promise<RecommendationView[]> {
  // rowid breaks created_at ties: one orchestrator run inserts a batch
  // within the same CURRENT_TIMESTAMP second.
  const { results } = await db
    .prepare(
      `SELECT r.id, r.asset_id, a.name AS asset_name, r.action, r.reasoning,
              r.confidence, r.model, r.created_at
       FROM recommendations r
       LEFT JOIN assets a ON a.id = r.asset_id
       WHERE r.user_id = ?1 AND r.card_id = ?2
       ORDER BY r.created_at DESC, r.rowid DESC
       LIMIT ?3`
    )
    .bind(userId, cardId, limit)
    .all<RawRecommendationRow>();

  return results.map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name,
    action: row.action,
    reasoning: row.reasoning,
    confidence: row.confidence,
    model: row.model,
    createdAt: row.created_at,
  }));
}
