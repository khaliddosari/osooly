import "server-only";
import { getDb } from "@/lib/db";
import { layoutSolver } from "./layout-solver";
import { getCard } from "./registry";
import type { CardRect } from "./types";

/**
 * Layout persistence (PRD §3.5): one user_dashboard_layout row per card the
 * user has added, holding the solver's output rect. The *order* implied by
 * (page, y, x) is the durable user intent; geometry is always recomputed by
 * the solver against the current registry, so a card whose defaultSize
 * changes between deploys can never corrupt a stored layout.
 */

/** Card ids in visual order (page, then top-left to bottom-right). */
export async function loadCardOrder(userId: string): Promise<string[]> {
  const db = await getDb();
  const { results } = await db
    .prepare(
      `SELECT card_id FROM user_dashboard_layout
       WHERE user_id = ?1 ORDER BY page, y, x`
    )
    .bind(userId)
    .all<{ card_id: string }>();
  // Cards removed from the registry since the layout was saved are dropped
  // silently — their rows get cleaned up on the next save.
  return results.map((r) => r.card_id).filter((id) => getCard(id));
}

/**
 * Solve the given order against the registry and replace the user's stored
 * layout with the result. Returns the solved rects so callers can render
 * exactly what was persisted.
 */
export async function saveCardOrder(
  userId: string,
  orderedCardIds: string[]
): Promise<CardRect[]> {
  const cards = orderedCardIds
    .map((id) => getCard(id))
    .filter((def) => def !== undefined)
    .map((def) => ({
      id: def.id,
      defaultSize: def.defaultSize,
      minSize: def.minSize,
    }));
  const rects = layoutSolver(cards);

  const db = await getDb();
  const statements = [
    db.prepare(`DELETE FROM user_dashboard_layout WHERE user_id = ?1`).bind(userId),
    ...rects.map((r) =>
      db
        .prepare(
          `INSERT INTO user_dashboard_layout
             (user_id, card_id, page, x, y, w, h)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        )
        .bind(userId, r.cardId, r.page, r.x, r.y, r.w, r.h)
    ),
  ];
  await db.batch(statements);
  return rects;
}
