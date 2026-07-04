/**
 * D1 access for `user_preferences` (PRD 3.9), behind the /account page (S9).
 * Takes a D1Database handle and stays free of server-only imports, matching
 * the other lib stores.
 */

import {
  DEFAULT_PREFERENCES,
  parsePreferences,
  type UserPreferences,
} from "./preferences";

interface RawPreferencesRow {
  locale: string;
  display_currency: string;
}

/** A user's preferences, or the defaults when they have never saved any. */
export async function getPreferences(
  db: D1Database,
  userId: string
): Promise<UserPreferences> {
  const row = await db
    .prepare(
      `SELECT locale, display_currency FROM user_preferences WHERE user_id = ?1`
    )
    .bind(userId)
    .first<RawPreferencesRow>();
  if (!row) return { ...DEFAULT_PREFERENCES };
  return parsePreferences({
    locale: row.locale,
    displayCurrency: row.display_currency,
  });
}

/** Upsert a user's preferences (one row per user, created lazily). */
export async function savePreferences(
  db: D1Database,
  userId: string,
  prefs: UserPreferences
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_preferences (user_id, locale, display_currency, updated_at)
       VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         locale = excluded.locale,
         display_currency = excluded.display_currency,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(userId, prefs.locale, prefs.displayCurrency)
    .run();
}
