"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import {
  ALERT_CHANNELS,
  formatPredicate,
  type AlertChannel,
  type AlertField,
  type AlertOp,
} from "@/lib/alerts/predicates";
import type { AlertView } from "@/lib/alerts/store";
import type { AssetClass } from "@/lib/market-snapshot";
import { cn } from "@/lib/utils";

/**
 * The per-card "Notify me when …" surface (PRD §3.8a): lists the card's
 * existing alert rules and lets the user add one. Self-contained — it reads
 * and writes /api/alerts directly rather than threading alert state through
 * each card's server fetcher, so adding it to a card is one render line plus a
 * small `targets` derivation from the card's already-loaded data.
 */

export interface AlertTarget {
  /** Unique <option> value within the card. */
  key: string;
  /** Human label, e.g. "TASI index", "Gold spot (SAR/g)", "Land Cruiser". */
  label: string;
  assetClass: AssetClass;
  /** market_snapshot symbol the evaluator watches. */
  symbol: string;
  /** Set for a per-asset rule; omitted for a card-level (market) rule. */
  assetId?: string | null;
  currency?: string;
}

const CHANNEL_LABELS: Record<AlertChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  web_push: "Web push",
};

const FIELD_LABELS: Record<AlertField, string> = {
  price: "Price",
  percent_change: "Daily % change",
};

// The form exposes the two PRD conditions; the predicate type carries the rest.
const OP_OPTIONS: { value: AlertOp; label: string }[] = [
  { value: "gt", label: "rises above" },
  { value: "lt", label: "falls below" },
];

export function AlertRuleForm({
  cardId,
  targets,
}: {
  cardId: string;
  targets: AlertTarget[];
}) {
  const [alerts, setAlerts] = useState<AlertView[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [targetKey, setTargetKey] = useState(targets[0]?.key ?? "");
  const [field, setField] = useState<AlertField>("price");
  const [op, setOp] = useState<AlertOp>("gt");
  const [value, setValue] = useState("");
  const [channels, setChannels] = useState<AlertChannel[]>(["email"]);

  useEffect(() => {
    let active = true;
    fetch(`/api/alerts?cardId=${encodeURIComponent(cardId)}`)
      .then(async (res) =>
        res.ok ? ((await res.json()) as { alerts?: AlertView[] }) : null
      )
      .then((body) => {
        if (active && body) setAlerts(body.alerts ?? []);
      })
      .catch(() => {
        /* a failed list just leaves the section empty; the form still works */
      });
    return () => {
      active = false;
    };
  }, [cardId]);

  const activeTarget = targets.find((t) => t.key === targetKey) ?? null;
  const currencyFor = (symbol: string) =>
    targets.find((t) => t.symbol === symbol)?.currency ?? "SAR";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const numeric = Number(value);
    if (!activeTarget) return;
    if (value.trim() === "" || !Number.isFinite(numeric)) {
      setError("Enter a number to compare against.");
      return;
    }
    if (channels.length === 0) {
      setError("Pick at least one delivery channel.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cardId,
          assetId: activeTarget.assetId ?? null,
          assetClass: activeTarget.assetClass,
          symbol: activeTarget.symbol,
          field,
          op,
          value: numeric,
          channels,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;
      if (!res.ok || !body?.id) {
        throw new Error(body?.error ?? "Could not save the alert.");
      }
      setAlerts((prev) => [
        {
          id: body.id as string,
          cardId,
          assetId: activeTarget.assetId ?? null,
          assetName: activeTarget.label,
          predicate: {
            assetClass: activeTarget.assetClass,
            symbol: activeTarget.symbol,
            field,
            op,
            value: numeric,
          },
          channels,
          enabled: true,
          createdAt: nowSqlite(),
          lastFiredAt: null,
        },
        ...prev,
      ]);
      setValue("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the alert.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(alert: AlertView) {
    const next = !alert.enabled;
    setAlerts((prev) =>
      prev.map((a) => (a.id === alert.id ? { ...a, enabled: next } : a))
    );
    const res = await fetch(`/api/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    if (!res.ok) {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alert.id ? { ...a, enabled: alert.enabled } : a
        )
      );
    }
  }

  async function remove(id: string) {
    const snapshot = alerts;
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    if (!res.ok) setAlerts(snapshot);
  }

  const preview =
    activeTarget && value.trim() !== "" && Number.isFinite(Number(value))
      ? formatPredicate(
          {
            assetClass: activeTarget.assetClass,
            symbol: activeTarget.symbol,
            field,
            op,
            value: Number(value),
          },
          activeTarget.currency ?? "SAR"
        )
      : null;

  return (
    <div className="flex flex-col gap-2 border-t border-outline-variant pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-label-sm uppercase tracking-wider text-on-surface-variant">
          <Icon name="notifications" style={{ fontSize: 12 }} />
          Alerts{alerts.length > 0 ? ` (${alerts.length})` : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setError(null);
          }}
          disabled={targets.length === 0}
          title={
            targets.length === 0
              ? "Track a holding to set price alerts"
              : undefined
          }
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container px-2.5 py-0.5 text-label-sm text-on-surface-variant transition-colors",
            targets.length === 0
              ? "cursor-not-allowed opacity-50"
              : "hover:border-primary hover:text-primary"
          )}
        >
          <Icon name={open ? "close" : "add"} style={{ fontSize: 11 }} />
          {open ? "cancel" : "Notify me"}
        </button>
      </div>

      {alerts.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {alerts.map((alert) => (
            <li key={alert.id} className="flex items-start gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p
                  className={cn(
                    "text-label-md",
                    alert.enabled
                      ? "text-on-surface"
                      : "text-on-surface-variant line-through"
                  )}
                >
                  <span className="font-semibold">
                    {alert.assetName ?? alert.predicate.symbol}
                  </span>{" "}
                  · {formatPredicate(alert.predicate, currencyFor(alert.predicate.symbol))}
                </p>
                <span className="text-label-sm text-on-surface-variant">
                  {alert.channels.map((c) => CHANNEL_LABELS[c]).join(", ")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => toggle(alert)}
                title={alert.enabled ? "Disable" : "Enable"}
                className="text-on-surface-variant transition-colors hover:text-primary"
              >
                <Icon
                  name={alert.enabled ? "notifications" : "notifications_off"}
                  style={{ fontSize: 13 }}
                />
              </button>
              <button
                type="button"
                onClick={() => remove(alert.id)}
                title="Delete"
                className="text-on-surface-variant transition-colors hover:text-error"
              >
                <Icon name="delete" style={{ fontSize: 13 }} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && activeTarget && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          {targets.length > 1 && (
            <select
              aria-label="Asset to watch"
              value={targetKey}
              onChange={(e) => setTargetKey(e.target.value)}
              className={selectClass}
            >
              {targets.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          )}

          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Field"
              value={field}
              onChange={(e) => setField(e.target.value as AlertField)}
              className={selectClass}
            >
              {(Object.keys(FIELD_LABELS) as AlertField[]).map((f) => (
                <option key={f} value={f}>
                  {FIELD_LABELS[f]}
                </option>
              ))}
            </select>
            <select
              aria-label="Condition"
              value={op}
              onChange={(e) => setOp(e.target.value as AlertOp)}
              className={selectClass}
            >
              {OP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              aria-label="Threshold"
              type="number"
              inputMode="decimal"
              step="any"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={field === "price" ? "200" : "-5"}
              className={cn(selectClass, "w-24")}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {ALERT_CHANNELS.map((channel) => {
              const checked = channels.includes(channel);
              return (
                <button
                  key={channel}
                  type="button"
                  onClick={() =>
                    setChannels((prev) =>
                      checked
                        ? prev.filter((c) => c !== channel)
                        : [...prev, channel]
                    )
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-label-sm transition-colors",
                    checked
                      ? "border-primary text-primary"
                      : "border-outline-variant text-on-surface-variant hover:border-primary"
                  )}
                >
                  {CHANNEL_LABELS[channel]}
                </button>
              );
            })}
          </div>

          {preview && (
            <p className="text-label-sm text-on-surface-variant">
              Notify when <span className="text-on-surface">{preview}</span>.
            </p>
          )}
          {error && (
            <p role="alert" className="text-label-sm text-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className={cn(
              "self-start rounded-full border border-primary bg-surface-container px-3 py-1 text-label-sm text-primary transition-colors",
              saving ? "cursor-wait opacity-60" : "hover:bg-primary/10"
            )}
          >
            {saving ? "saving" : "Save alert"}
          </button>
        </form>
      )}
    </div>
  );
}

const selectClass =
  "rounded-lg border border-outline-variant bg-surface-container px-2 py-1 text-label-md text-on-surface";

/** SQLite UTC shape for the optimistic row, matching server timestamps. */
function nowSqlite(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}
