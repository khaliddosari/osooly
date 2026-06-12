"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { formatAge } from "@/lib/market-snapshot";
import type {
  RecommendationAction,
  RecommendationView,
} from "@/lib/recommendations";
import { cn } from "@/lib/utils";

/**
 * The agent's recommendation surface inside every market card (PRD §3.6):
 * the latest N rows for the card's asset class, plus the button that
 * triggers a fresh orchestrator run (POST /api/agent/run) and re-renders
 * the dashboard. Shared across the four cards so action chips, confidence,
 * and model attribution can't drift between asset classes.
 */
export function RecommendationList({
  recommendations,
}: {
  recommendations: RecommendationView[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = running || isPending;

  async function runAnalyst() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/agent/run", { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `analyst run failed (${response.status})`);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "analyst run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-outline-variant pt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-label-sm uppercase tracking-wider text-on-surface-variant">
          <Icon name="auto_awesome" style={{ fontSize: 12 }} />
          Analyst
        </span>
        <button
          type="button"
          onClick={runAnalyst}
          disabled={busy}
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container px-2.5 py-0.5 text-label-sm text-on-surface-variant transition-colors",
            busy
              ? "cursor-wait opacity-60"
              : "hover:border-primary hover:text-primary"
          )}
        >
          <Icon
            name="refresh"
            className={cn(busy && "animate-spin motion-reduce:animate-none")}
            style={{ fontSize: 11 }}
          />
          {busy ? "analyzing" : "refresh"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-label-sm text-error">
          {error}
        </p>
      )}

      {recommendations.length === 0 ? (
        !error && (
          <p className="text-label-sm text-on-surface-variant">
            No recommendations yet. Refresh to have the analyst review your
            holdings.
          </p>
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {recommendations.map((rec) => (
            <li key={rec.id} className="flex items-start gap-2.5">
              <ActionChip action={rec.action} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-label-md text-on-surface">
                  {rec.assetName && (
                    <span className="font-semibold">{rec.assetName} · </span>
                  )}
                  {rec.reasoning}
                </p>
                <span className="text-label-sm text-on-surface-variant">
                  {Math.round(rec.confidence * 100)}% confidence ·{" "}
                  {rec.model.split("/")[0]} · {recAge(rec.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ACTION_STYLES: Record<RecommendationAction, string> = {
  buy: "text-success-green border-success-green/40 bg-surface-green-tint",
  sell: "text-error border-error/40 bg-error-container",
  hold: "text-on-surface-variant border-outline-variant bg-surface-container",
  watch: "text-warning-orange border-warning-orange/40 bg-surface-container",
};

function ActionChip({ action }: { action: RecommendationAction }) {
  return (
    <span
      className={cn(
        "mt-0.5 rounded-full border px-2 py-0.5 text-label-sm uppercase tracking-wider",
        ACTION_STYLES[action]
      )}
    >
      {action}
    </span>
  );
}

/** "3h ago" from a SQLite UTC timestamp; mirrors the freshness badge math. */
function recAge(createdAt: string): string {
  const normalised = /[zZ]|[+-]\d\d:\d\d$/.test(createdAt)
    ? createdAt
    : `${createdAt.replace(" ", "T")}Z`;
  const ageMs = Math.max(0, Date.now() - new Date(normalised).getTime());
  return `${formatAge(ageMs)} ago`;
}
