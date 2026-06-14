import { describe, expect, it, vi } from "vitest";
import { ANCIENT_UTC, fakeDb, hoursAgoUtc } from "@/src/cards/testing";
import { evaluateAlerts, handleAlertDelivery } from "./alerts-evaluator";
import type { CronEnv } from "./config";

const WEBHOOK = "https://n8n.test/webhook/osooly-alert";
const TOKEN = "secret-token";

function okFetch() {
  return vi.fn(async () => new Response(null, { status: 200 }));
}

/** One enabled "AAPL price > 200" rule for user u1, card-level (no asset_id). */
function aaplAlertDb(overrides: { last_fired_at?: string | null } = {}) {
  return fakeDb({
    snapshots: [{ assetClass: "stocks", symbol: "AAPL", price: 211.5, currency: "USD" }],
    users: [{ id: "u1", email: "holder@example.com", name: "Holder" }],
    alerts: [
      {
        id: "al1",
        user_id: "u1",
        card_id: "stock-market",
        predicate: {
          assetClass: "stocks",
          symbol: "AAPL",
          field: "price",
          op: "gt",
          value: 200,
        },
        channels: ["email", "telegram"],
        last_fired_at: overrides.last_fired_at ?? null,
      },
    ],
  });
}

function env(db: ReturnType<typeof fakeDb>, extra: Partial<CronEnv> = {}): CronEnv {
  return {
    DB: db,
    ALERTS_WEBHOOK_URL: WEBHOOK,
    ALERTS_WEBHOOK_TOKEN: TOKEN,
    ...extra,
  } as CronEnv;
}

describe("evaluateAlerts", () => {
  it("POSTs a match to the n8n webhook and stamps last_fired_at on success", async () => {
    const db = aaplAlertDb();
    const fetchFn = okFetch();
    await evaluateAlerts(env(db), "stocks", { fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(WEBHOOK);
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${TOKEN}`
    );
    const payload = JSON.parse(init.body as string);
    expect(payload.value).toBe(211.5);
    expect(payload.predicate).toEqual({ field: "price", op: "gt", value: 200 });
    expect(payload.channels).toEqual(["email", "telegram"]);
    expect(payload.user.email).toBe("holder@example.com");
    expect(payload.asset).toMatchObject({ symbol: "AAPL", assetClass: "stocks" });
    expect(typeof payload.triggered_at).toBe("string");

    expect(db.alerts[0].last_fired_at).toBe(payload.triggered_at);
  });

  it("does not fire when the predicate is not satisfied", async () => {
    const db = fakeDb({
      snapshots: [{ assetClass: "stocks", symbol: "AAPL", price: 180 }],
      users: [{ id: "u1" }],
      alerts: [
        {
          id: "al1",
          user_id: "u1",
          card_id: "stock-market",
          predicate: {
            assetClass: "stocks",
            symbol: "AAPL",
            field: "price",
            op: "gt",
            value: 200,
          },
          channels: ["email"],
        },
      ],
    });
    const fetchFn = okFetch();
    await evaluateAlerts(env(db), "stocks", { fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(db.alerts[0].last_fired_at).toBeNull();
  });

  it("never fires on degraded (stale/unavailable) data", async () => {
    const db = fakeDb({
      snapshots: [
        { assetClass: "stocks", symbol: "AAPL", price: 211.5, fetchedAt: ANCIENT_UTC },
      ],
      users: [{ id: "u1" }],
      alerts: [
        {
          id: "al1",
          user_id: "u1",
          card_id: "stock-market",
          predicate: {
            assetClass: "stocks",
            symbol: "AAPL",
            field: "price",
            op: "gt",
            value: 200,
          },
          channels: ["email"],
        },
      ],
    });
    const fetchFn = okFetch();
    await evaluateAlerts(env(db), "stocks", { fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("does not fire on a stale (but not yet unavailable) reading", async () => {
    // 3h old: past the stocks 1h "stale" cutoff, short of "unavailable".
    const db = fakeDb({
      snapshots: [
        { assetClass: "stocks", symbol: "AAPL", price: 211.5, fetchedAt: hoursAgoUtc(3) },
      ],
      users: [{ id: "u1" }],
      alerts: [
        {
          id: "al1",
          user_id: "u1",
          card_id: "stock-market",
          predicate: {
            assetClass: "stocks",
            symbol: "AAPL",
            field: "price",
            op: "gt",
            value: 200,
          },
          channels: ["email"],
        },
      ],
    });
    const fetchFn = okFetch();
    await evaluateAlerts(env(db), "stocks", { fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("debounces a standing breach inside the cooldown window", async () => {
    const db = aaplAlertDb({ last_fired_at: hoursAgoUtc(1) });
    const fetchFn = okFetch();
    await evaluateAlerts(env(db), "stocks", { fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("re-fires once the cooldown has elapsed", async () => {
    const db = aaplAlertDb({ last_fired_at: hoursAgoUtc(7) });
    const fetchFn = okFetch();
    await evaluateAlerts(env(db), "stocks", { fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("leaves last_fired_at untouched when the webhook POST fails", async () => {
    const db = aaplAlertDb();
    const fetchFn = vi.fn(async () => new Response(null, { status: 500 }));
    await evaluateAlerts(env(db), "stocks", { fetchFn });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(db.alerts[0].last_fired_at).toBeNull();
  });

  it("logs a clean skip and fires nothing without a webhook URL", async () => {
    const db = aaplAlertDb();
    const fetchFn = okFetch();
    await evaluateAlerts(env(db, { ALERTS_WEBHOOK_URL: undefined }), "stocks", {
      fetchFn,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("handleAlertDelivery", () => {
  it("records the delivery time on an authorized callback", async () => {
    const db = aaplAlertDb({ last_fired_at: hoursAgoUtc(0) });
    const request = new Request("https://cron.test/alert-delivery", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ alertId: "al1", delivered_at: "2026-06-14 10:00:00" }),
    });
    const response = await handleAlertDelivery(request, env(db));
    expect(response.status).toBe(204);
    expect(db.alerts[0].last_fired_at).toBe("2026-06-14 10:00:00");
  });

  it("rejects a callback with a bad token", async () => {
    const db = aaplAlertDb();
    const request = new Request("https://cron.test/alert-delivery", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
      body: JSON.stringify({ alertId: "al1" }),
    });
    const response = await handleAlertDelivery(request, env(db));
    expect(response.status).toBe(401);
  });

  it("400s when alertId is missing", async () => {
    const db = aaplAlertDb();
    const request = new Request("https://cron.test/alert-delivery", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({}),
    });
    const response = await handleAlertDelivery(request, env(db));
    expect(response.status).toBe(400);
  });
});
