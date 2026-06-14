import { evaluatePredicate, formatPredicate } from "../../lib/alerts/predicates";
import {
  listFiringAlerts,
  recordAlertFired,
  type FiringAlert,
} from "../../lib/alerts/store";
import { asNumber } from "../../lib/format";
import { readSnapshots, type AssetClass } from "../../lib/market-snapshot";
import type { CronEnv } from "./config";

/**
 * The alerts evaluator (PRD §3.8a step 2-3). It runs right after each market
 * refresh on that asset's cadence (wired in index.ts), re-evaluates the
 * enabled predicates for the class, and POSTs every match to the single n8n
 * webhook (`/webhook/osooly-alert`). n8n owns the fan-out and per-user rate
 * limits; Osooly only debounces so a sustained breach doesn't re-POST every
 * cron cycle.
 *
 * Degrade, don't fire on bad data: a stale / unavailable / price-less snapshot
 * is skipped (PRD §3.5a rule 2), so an outage never fires phantom alerts.
 */

/** Min gap between two POSTs for the same rule. n8n applies the user-facing
 * rate limits; this just stops the every-minute stocks cron from re-sending a
 * standing breach. */
const FIRE_COOLDOWN_MS = 6 * 36e5;

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

interface EvalDeps {
  now?: Date;
  fetchFn?: FetchFn;
}

export async function evaluateAlerts(
  env: CronEnv,
  assetClass: AssetClass,
  deps: EvalDeps = {}
): Promise<void> {
  const now = deps.now ?? new Date();
  const fetchFn = deps.fetchFn ?? ((input, init) => fetch(input, init));

  if (!env.ALERTS_WEBHOOK_URL) {
    console.log(
      JSON.stringify({
        event: "alerts.skipped",
        assetClass,
        reason: "ALERTS_WEBHOOK_URL not configured",
      })
    );
    return;
  }

  const alerts = await listFiringAlerts(env.DB, assetClass);
  if (alerts.length === 0) return;

  const symbols = [...new Set(alerts.map((a) => a.predicate.symbol))];
  const readings = await readSnapshots(env.DB, assetClass, symbols, now);
  const bySymbol = new Map(readings.map((r) => [r.symbol, r]));

  let fired = 0;
  let skipped = 0;
  for (const alert of alerts) {
    // Fire only on current data: a stale / unavailable / price-less snapshot
    // means an outage, not a real move (PRD §3.5a rule 2), so skip it.
    const reading = bySymbol.get(alert.predicate.symbol);
    if (!reading || reading.freshness !== "fresh" || reading.price === null) {
      skipped++;
      continue;
    }
    const { matches, observed } = evaluatePredicate(alert.predicate, {
      price: reading.price,
      percentChange: asNumber(reading.payload?.percentChange),
    });
    if (!matches || observed === null) continue;

    if (withinCooldown(alert.lastFiredAt, now)) {
      skipped++;
      continue;
    }

    const triggeredAt = toSqliteUtc(now);
    const delivered = await postWebhook(env, fetchFn, {
      alert,
      observed,
      currency: reading.currency,
      triggeredAt,
    });
    if (delivered) {
      // Stamp on a 2xx only: a failed POST leaves last_fired_at untouched so
      // the next cron cycle retries instead of silently dropping the alert.
      await recordAlertFired(env.DB, alert.id, triggeredAt);
      fired++;
    } else {
      skipped++;
    }
  }

  console.log(
    JSON.stringify({
      event: "alerts.evaluated",
      assetClass,
      candidates: alerts.length,
      fired,
      skipped,
    })
  );
}

interface WebhookArgs {
  alert: FiringAlert;
  observed: number;
  currency: string;
  triggeredAt: string;
}

/** POST one match to the n8n webhook. Returns true on a 2xx. */
async function postWebhook(
  env: CronEnv,
  fetchFn: FetchFn,
  { alert, observed, currency, triggeredAt }: WebhookArgs
): Promise<boolean> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (env.ALERTS_WEBHOOK_TOKEN) {
    headers.authorization = `Bearer ${env.ALERTS_WEBHOOK_TOKEN}`;
  }

  const { predicate } = alert;
  const payload = {
    alertId: alert.id,
    user: { id: alert.userId, email: alert.userEmail, name: alert.userName },
    asset: {
      id: alert.assetId,
      name: alert.assetName ?? predicate.symbol,
      assetClass: predicate.assetClass,
      symbol: predicate.symbol,
    },
    predicate: {
      field: predicate.field,
      op: predicate.op,
      value: predicate.value,
      ...(predicate.window ? { window: predicate.window } : {}),
    },
    channels: alert.channels,
    summary: formatPredicate(predicate, currency),
    value: observed,
    currency,
    triggered_at: triggeredAt,
  };

  try {
    const response = await fetchFn(env.ALERTS_WEBHOOK_URL as string, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error(
        JSON.stringify({
          event: "alerts.fire_failed",
          alertId: alert.id,
          status: response.status,
        })
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "alerts.fire_failed",
        alertId: alert.id,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return false;
  }
}

/**
 * Delivery callback (PRD §3.8a step 4): the n8n workflow POSTs here once it has
 * fanned the alert out, so Osooly records the confirmed delivery time. Bearer
 * token must match ALERTS_WEBHOOK_TOKEN; the body carries the alert id.
 */
export async function handleAlertDelivery(
  request: Request,
  env: CronEnv,
  now: Date = new Date()
): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!isAuthorized(request, env)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    alertId?: unknown;
    delivered_at?: unknown;
  } | null;
  const alertId = typeof body?.alertId === "string" ? body.alertId : "";
  if (!alertId) {
    return new Response("Missing alertId", { status: 400 });
  }

  const deliveredAt =
    typeof body?.delivered_at === "string" ? body.delivered_at : toSqliteUtc(now);
  await recordAlertFired(env.DB, alertId, deliveredAt);
  console.log(
    JSON.stringify({ event: "alerts.delivered", alertId, deliveredAt })
  );
  return new Response(null, { status: 204 });
}

function isAuthorized(request: Request, env: CronEnv): boolean {
  if (!env.ALERTS_WEBHOOK_TOKEN) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${env.ALERTS_WEBHOOK_TOKEN}`;
}

function withinCooldown(lastFiredAt: string | null, now: Date): boolean {
  if (!lastFiredAt) return false;
  return now.getTime() - sqliteUtcToMs(lastFiredAt) < FIRE_COOLDOWN_MS;
}

/** SQLite CURRENT_TIMESTAMP is UTC without a zone suffix; pin it (mirrors
 * lib/market-snapshot's parser). */
function sqliteUtcToMs(value: string): number {
  const normalised = /[zZ]|[+-]\d\d:\d\d$/.test(value)
    ? value
    : `${value.replace(" ", "T")}Z`;
  return new Date(normalised).getTime();
}

function toSqliteUtc(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}
