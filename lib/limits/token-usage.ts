/**
 * Per-user monthly LLM token accounting (PRD 3.9 cost controls), surfaced on
 * /subscription (S9). Takes a D1Database handle and stays free of server-only
 * imports so both the page and (in S10) the agent run path can use it.
 *
 * Split across stages: S9 owns the read + display side (getMonthlyTokenUsage,
 * the cap constant, the period helper); S10 calls recordTokenUsage() from the
 * agent run seam and enforces MONTHLY_TOKEN_CAP (see app/api/agent/run/route.ts).
 * The counter is keyed by calendar month so it resets automatically without a
 * cron job.
 */

/** The v1 monthly token allowance backing the 1 SAR/month plan (PRD 3.10). */
export const MONTHLY_TOKEN_CAP = 1_000_000;

/** Calendar-month key 'YYYY-MM' in UTC; the counter's period column. */
export function currentPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export interface TokenUsage {
  period: string;
  used: number;
  cap: number;
  /** 0-1 fraction of the cap consumed, clamped to [0, 1]. */
  fraction: number;
  remaining: number;
}

/** Build a usage summary from a raw token count. Pure: the display math the
 * page and its tests share, independent of D1. */
export function summarizeUsage(used: number, now: Date = new Date()): TokenUsage {
  const safeUsed = Number.isFinite(used) ? Math.max(0, used) : 0;
  return {
    period: currentPeriod(now),
    used: safeUsed,
    cap: MONTHLY_TOKEN_CAP,
    fraction: Math.min(1, safeUsed / MONTHLY_TOKEN_CAP),
    remaining: Math.max(0, MONTHLY_TOKEN_CAP - safeUsed),
  };
}

/** This calendar month's usage for a user; zero when no row exists yet. */
export async function getMonthlyTokenUsage(
  db: D1Database,
  userId: string,
  now: Date = new Date()
): Promise<TokenUsage> {
  const period = currentPeriod(now);
  const row = await db
    .prepare(
      `SELECT tokens FROM llm_token_usage WHERE user_id = ?1 AND period = ?2`
    )
    .bind(userId, period)
    .first<{ tokens: number }>();
  return summarizeUsage(row?.tokens ?? 0, now);
}

/**
 * Add tokens to the current period's counter (upsert). Not yet wired into the
 * agent run path; that, plus cap enforcement, lands in S10. Exported now so the
 * counter this page reads has a single writer to grow into.
 */
export async function recordTokenUsage(
  db: D1Database,
  userId: string,
  tokens: number,
  now: Date = new Date()
): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const period = currentPeriod(now);
  await db
    .prepare(
      `INSERT INTO llm_token_usage (user_id, period, tokens, updated_at)
       VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, period) DO UPDATE SET
         tokens = tokens + excluded.tokens,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(userId, period, Math.round(tokens))
    .run();
}
