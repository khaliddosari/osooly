/**
 * D1 access for the `assets` ledger (PRD 3.2), behind the /assets page and its
 * API route (S9). Like lib/alerts/store.ts it takes a D1Database handle and
 * stays free of server-only / LangChain imports so route handlers can use it
 * directly.
 *
 * PII note (PRD 3.9): the class-specific `details` JSON is a [PII] column, so
 * every write routes the free-text note through sealPII() and every read
 * through openPII() (migrations/0001_init.sql). v1 ships those as pass-throughs;
 * S10 swaps the bodies for real column-level encryption without touching here.
 */

import { openPII, sealPII } from "../db";
import type { AssetInput, AssetView } from "./schema";

interface RawAssetRow {
  id: string;
  asset_class: string;
  name: string;
  symbol: string | null;
  quantity: number;
  unit: string | null;
  purchase_price: number | null;
  purchase_currency: string;
  purchased_at: string | null;
  details: string | null;
  created_at: string;
  updated_at: string;
}

/** The note we tuck into the details JSON; class-specific fields join it later. */
function packDetails(note: string | null): string | null {
  if (note === null) return null;
  return sealPII(JSON.stringify({ note }));
}

function unpackNote(details: string | null): string | null {
  const raw = openPII(details);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { note?: unknown };
    return typeof parsed.note === "string" ? parsed.note : null;
  } catch {
    return null;
  }
}

function toView(row: RawAssetRow): AssetView {
  return {
    id: row.id,
    name: row.name,
    assetClass: row.asset_class as AssetView["assetClass"],
    symbol: row.symbol,
    quantity: row.quantity,
    unit: row.unit,
    purchasePrice: row.purchase_price,
    purchaseCurrency: row.purchase_currency,
    purchasedAt: row.purchased_at,
    note: unpackNote(row.details),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every holding a user owns, newest first. The flat ledger the page filters. */
export async function listAssetsForUser(
  db: D1Database,
  userId: string
): Promise<AssetView[]> {
  const { results } = await db
    .prepare(
      `SELECT id, asset_class, name, symbol, quantity, unit, purchase_price,
              purchase_currency, purchased_at, details, created_at, updated_at
       FROM assets WHERE user_id = ?1
       ORDER BY created_at DESC, rowid DESC`
    )
    .bind(userId)
    .all<RawAssetRow>();
  return results.map(toView);
}

export async function insertAsset(
  db: D1Database,
  userId: string,
  input: AssetInput
): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO assets
         (id, user_id, asset_class, name, symbol, quantity, unit,
          purchase_price, purchase_currency, purchased_at, details)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
    )
    .bind(
      id,
      userId,
      input.assetClass,
      input.name,
      input.symbol,
      input.quantity,
      input.unit,
      input.purchasePrice,
      input.purchaseCurrency,
      input.purchasedAt,
      packDetails(input.note)
    )
    .run();
  return id;
}

/**
 * Update one holding, scoped to its owner so a guessed id can't touch another
 * user's row. Returns whether a row was actually changed.
 */
export async function updateAsset(
  db: D1Database,
  userId: string,
  id: string,
  input: AssetInput
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE assets SET
         asset_class = ?3, name = ?4, symbol = ?5, quantity = ?6, unit = ?7,
         purchase_price = ?8, purchase_currency = ?9, purchased_at = ?10,
         details = ?11, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1 AND user_id = ?2`
    )
    .bind(
      id,
      userId,
      input.assetClass,
      input.name,
      input.symbol,
      input.quantity,
      input.unit,
      input.purchasePrice,
      input.purchaseCurrency,
      input.purchasedAt,
      packDetails(input.note)
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** Delete one holding, scoped to its owner. Returns whether a row was removed. */
export async function deleteAsset(
  db: D1Database,
  userId: string,
  id: string
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM assets WHERE id = ?1 AND user_id = ?2`)
    .bind(id, userId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
