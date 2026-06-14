/**
 * D1 access for the `alerts` table (PRD §3.8a). Like lib/market-snapshot.ts
 * and lib/recommendations.ts, this module takes a D1Database handle and stays
 * free of server-only / LangChain imports, so it can be imported by both the
 * Next.js API route (app/api/alerts) and the alerts-evaluator Cron Worker.
 *
 * Stored shape: `predicate` and `channels` are JSON text columns; the watch
 * target (assetClass + symbol) lives inside `predicate` because the row has no
 * symbol column (see lib/alerts/predicates.ts).
 */

import {
  parseChannels,
  parsePredicate,
  type AlertChannel,
  type AlertPredicate,
} from "./predicates";
import type { AssetClass } from "../market-snapshot";

export interface NewAlert {
  userId: string;
  cardId: string;
  assetId: string | null;
  predicate: AlertPredicate;
  channels: AlertChannel[];
}

/** A rule as the owning user sees it (GET /api/alerts, card list). */
export interface AlertView {
  id: string;
  cardId: string;
  assetId: string | null;
  assetName: string | null;
  predicate: AlertPredicate;
  channels: AlertChannel[];
  enabled: boolean;
  createdAt: string;
  lastFiredAt: string | null;
}

/** A firing candidate the evaluator works on: the rule plus the user contact
 * and asset label it needs to build the n8n payload. */
export interface FiringAlert {
  id: string;
  userId: string;
  cardId: string;
  assetId: string | null;
  assetName: string | null;
  userEmail: string | null;
  userName: string | null;
  predicate: AlertPredicate;
  channels: AlertChannel[];
  lastFiredAt: string | null;
}

export async function insertAlert(
  db: D1Database,
  alert: NewAlert
): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO alerts (id, user_id, card_id, asset_id, predicate, channels, enabled)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)`
    )
    .bind(
      id,
      alert.userId,
      alert.cardId,
      alert.assetId,
      JSON.stringify(alert.predicate),
      JSON.stringify(alert.channels)
    )
    .run();
  return id;
}

interface RawUserAlertRow {
  id: string;
  card_id: string;
  asset_id: string | null;
  asset_name: string | null;
  predicate: string;
  channels: string;
  enabled: number;
  created_at: string;
  last_fired_at: string | null;
}

/** Every alert a user owns, newest first; optionally scoped to one card. */
export async function listAlertsForUser(
  db: D1Database,
  userId: string,
  cardId?: string
): Promise<AlertView[]> {
  const stmt = cardId
    ? db
        .prepare(
          `SELECT a.id, a.card_id, a.asset_id, ast.name AS asset_name,
                  a.predicate, a.channels, a.enabled, a.created_at, a.last_fired_at
           FROM alerts a LEFT JOIN assets ast ON ast.id = a.asset_id
           WHERE a.user_id = ?1 AND a.card_id = ?2
           ORDER BY a.created_at DESC, a.rowid DESC`
        )
        .bind(userId, cardId)
    : db
        .prepare(
          `SELECT a.id, a.card_id, a.asset_id, ast.name AS asset_name,
                  a.predicate, a.channels, a.enabled, a.created_at, a.last_fired_at
           FROM alerts a LEFT JOIN assets ast ON ast.id = a.asset_id
           WHERE a.user_id = ?1
           ORDER BY a.created_at DESC, a.rowid DESC`
        )
        .bind(userId);

  const { results } = await stmt.all<RawUserAlertRow>();
  return results.flatMap((row) => {
    const predicate = parsePredicate(safeJson(row.predicate));
    if (!predicate) return []; // drop a corrupt row rather than crash the list
    return [
      {
        id: row.id,
        cardId: row.card_id,
        assetId: row.asset_id,
        assetName: row.asset_name,
        predicate,
        channels: parseChannels(safeJson(row.channels)) ?? [],
        enabled: row.enabled === 1,
        createdAt: row.created_at,
        lastFiredAt: row.last_fired_at,
      },
    ];
  });
}

interface RawFiringRow {
  id: string;
  user_id: string;
  card_id: string;
  asset_id: string | null;
  asset_name: string | null;
  user_email: string | null;
  user_name: string | null;
  predicate: string;
  channels: string;
  last_fired_at: string | null;
}

/**
 * Enabled alerts whose watch target is in the given asset class, joined to the
 * user contact + asset name the n8n payload needs. The class filter reads the
 * predicate JSON so each refresh cron only re-evaluates the rules it can move.
 *
 * PII note (PRD §3.9): `user_email` / `user_name` are [PII] columns. v1 reads
 * them plain (sealPII/openPII are pass-throughs); when S10 lands real
 * column-level encryption these reads must route through openPII().
 */
export async function listFiringAlerts(
  db: D1Database,
  assetClass: AssetClass
): Promise<FiringAlert[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.user_id, a.card_id, a.asset_id, ast.name AS asset_name,
              u.email AS user_email, u.name AS user_name,
              a.predicate, a.channels, a.last_fired_at
       FROM alerts a
       LEFT JOIN assets ast ON ast.id = a.asset_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.enabled = 1 AND json_extract(a.predicate, '$.assetClass') = ?1`
    )
    .bind(assetClass)
    .all<RawFiringRow>();

  return results.flatMap((row) => {
    const predicate = parsePredicate(safeJson(row.predicate));
    if (!predicate) return [];
    return [
      {
        id: row.id,
        userId: row.user_id,
        cardId: row.card_id,
        assetId: row.asset_id,
        assetName: row.asset_name,
        userEmail: row.user_email,
        userName: row.user_name,
        predicate,
        channels: parseChannels(safeJson(row.channels)) ?? [],
        lastFiredAt: row.last_fired_at,
      },
    ];
  });
}

/** Stamp the fire/delivery time used both as the debounce anchor (evaluator,
 * on a 2xx from n8n) and as the delivery confirmation (n8n callback). */
export async function recordAlertFired(
  db: D1Database,
  id: string,
  firedAt: string
): Promise<void> {
  await db
    .prepare(`UPDATE alerts SET last_fired_at = ?2 WHERE id = ?1`)
    .bind(id, firedAt)
    .run();
}

/** Enable/disable a rule, scoped to its owner so one user can't toggle another's. */
export async function setAlertEnabled(
  db: D1Database,
  userId: string,
  id: string,
  enabled: boolean
): Promise<void> {
  await db
    .prepare(`UPDATE alerts SET enabled = ?3 WHERE id = ?1 AND user_id = ?2`)
    .bind(id, userId, enabled ? 1 : 0)
    .run();
}

/** Delete a rule, scoped to its owner. */
export async function deleteAlert(
  db: D1Database,
  userId: string,
  id: string
): Promise<void> {
  await db
    .prepare(`DELETE FROM alerts WHERE id = ?1 AND user_id = ?2`)
    .bind(id, userId)
    .run();
}

/** Confirm an asset belongs to the user before a per-asset alert references it. */
export async function assetBelongsToUser(
  db: D1Database,
  userId: string,
  assetId: string
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS ok FROM assets WHERE id = ?1 AND user_id = ?2`)
    .bind(assetId, userId)
    .first<{ ok: number }>();
  return row !== null;
}

function safeJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
