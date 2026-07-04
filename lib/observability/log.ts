/**
 * Structured event logging (PRD §3.9 observability, S10). One line of JSON per
 * event so Cloudflare Workers Logs / Logpush stay queryable by `event`, the
 * same shape the Cron Workers already emit (workers/cron/alerts-evaluator.ts).
 * Centralising it here keeps the field names (`event`, `ts`) consistent across
 * request logs, cron run logs, and alert-delivery logs.
 *
 * Never log secrets or raw PII: pass ids and counts, not tokens or asset notes.
 */

export type LogFields = Record<string, unknown>;

/** Emit an informational event to stdout (Workers Logs). */
export function logEvent(event: string, fields: LogFields = {}): void {
  console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...fields }));
}

/** Emit an error event to stderr, normalising the error to a message. */
export function logError(
  event: string,
  error: unknown,
  fields: LogFields = {}
): void {
  console.error(
    JSON.stringify({
      event,
      ts: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      ...fields,
    })
  );
}
