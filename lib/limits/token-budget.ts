/**
 * Per-user monthly token-cap enforcement (PRD §3.9, S10). S9 built the counter
 * and its display; this is the gate that turns the cap into a refusal. The
 * agent run route calls checkBudget() before starting a run and records the
 * run's tokens afterward (recordTokenUsage in token-usage.ts), so a user who
 * has spent their monthly allowance gets a clear 429, not a crash or a silent
 * overspend.
 *
 * The check is intentionally coarse (pre-run: "any budget left?") rather than
 * per-token: a single run can push a user slightly over the cap, but never far,
 * because runs are bounded (one triage + optional reasoning call per holding).
 * Simpler and cheaper than mid-run accounting, and it never strands a user
 * mid-analysis.
 */

import { getMonthlyTokenUsage, type TokenUsage } from "./token-usage";

export interface BudgetCheck {
  /** False once the month's allowance is exhausted. */
  allowed: boolean;
  usage: TokenUsage;
}

/** Decide whether a user may start another agent run this month. */
export async function checkBudget(
  db: D1Database,
  userId: string,
  now: Date = new Date()
): Promise<BudgetCheck> {
  const usage = await getMonthlyTokenUsage(db, userId, now);
  return { allowed: usage.remaining > 0, usage };
}
