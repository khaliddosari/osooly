"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import {
  getResult,
  getStatus,
  plotUrl,
  type FeatureImportance,
  type RunResult,
  type TuningTrial,
} from "@/lib/namtheg/api";
import { cn } from "@/lib/utils";

function AccuracyAndFeaturesCard({
  features,
  accuracyPct,
  accuracyLabel,
  trainScore,
  overfitGap,
}: {
  features: FeatureImportance[];
  accuracyPct: number;
  accuracyLabel: string;
  trainScore?: number;
  overfitGap?: number;
}) {
  const top = features.slice(0, 5);
  const max = Math.max(...top.map((f) => f.importance), 0);
  const trendKind = accuracyPct >= 85 ? "up" : accuracyPct >= 65 ? "flat" : "down";
  const trendColor =
    trendKind === "down"
      ? "text-error"
      : trendKind === "up"
        ? "text-success-green"
        : "text-on-surface-variant";

  return (
    <div className="glass flex h-full flex-col p-6 text-left">
      <div className="mb-4 flex items-start justify-between">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-green-tint text-success-green">
          <Icon name="target" style={{ fontSize: 22 }} />
        </span>
        <span className={cn("flex shrink-0 items-center gap-1 text-sm font-bold", trendColor)}>
          <Icon
            name={trendKind === "up" ? "trending_up" : trendKind === "down" ? "trending_down" : "horizontal_rule"}
            style={{ fontSize: 15 }}
          />
          {trendKind === "up" ? "Excellent match" : trendKind === "flat" ? "Moderate accuracy" : "Weak fit"}
        </span>
      </div>
      <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-on-surface-variant">
        {accuracyLabel}
      </h3>
      <div className="font-mono text-4xl font-black leading-none text-success-green">
        {accuracyPct.toFixed(2)}
        <span className="ml-1 font-sans text-base font-bold text-success-green/70">%</span>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-variant">
        <div className="h-full rounded-full bg-success-green" style={{ width: `${accuracyPct}%` }} />
      </div>
      {trainScore !== undefined && (
        <div className="mt-3 flex flex-wrap justify-between gap-1">
          {overfitGap !== undefined && overfitGap > 0.12 && (
            <span className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-warning-orange">
              <Icon name="warning" style={{ fontSize: 13 }} />
              Overfit warning: {(overfitGap * 100).toFixed(0)}% gap
            </span>
          )}
          <span className="font-mono text-sm font-bold uppercase tracking-wider text-on-surface-variant">
            Train score: {(trainScore * 100).toFixed(1)}%
          </span>
        </div>
      )}

      <div className="my-6 border-t border-outline-variant" />

      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-headline-md font-bold text-on-background">Feature importance</h3>
        <Icon name="analytics" className="text-outline" style={{ fontSize: 18 }} />
      </div>
      <div className="flex flex-1 flex-col gap-4">
        {top.map((f) => {
          const pct = max > 0 ? (f.importance / max) * 100 : 0;
          const alpha = 0.15 + (pct / 100) * 0.85;
          return (
            <div key={f.feature}>
              <div className="mb-2 flex justify-between text-sm font-bold">
                <span className="mr-2 truncate text-on-background">{f.feature}</span>
                <span className="font-mono text-on-surface-variant">{f.importance.toFixed(4)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-surface-variant">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: `rgba(79, 195, 247, ${alpha})` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TuningResultsCard({
  trials,
  baseline,
  optimized,
  metric,
  modelName,
}: {
  trials: TuningTrial[];
  baseline: number;
  optimized: number;
  metric: string;
  modelName: string;
}) {
  const improved = optimized > baseline + 0.0001;
  const deltaPct = ((optimized - baseline) * 100).toFixed(2);
  const tuningTrials = trials.filter((t) => t.trial > 0);

  return (
    <div className="glass overflow-hidden text-left">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant bg-surface-container-low p-5">
        <div>
          <h3 className="text-headline-md font-bold text-on-background">Hyperparameter tuning</h3>
          <p className="mt-1.5 font-mono text-xs text-on-surface-variant">
            Agentic optimization loop · {tuningTrials.length}{" "}
            {tuningTrials.length === 1 ? "trial" : "trials"} on{" "}
            <strong className="text-primary">{modelName}</strong>
          </p>
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold",
            improved
              ? "border-success-green/20 bg-surface-green-tint text-success-green"
              : "border-outline-variant bg-surface-container text-outline"
          )}
        >
          <Icon name={improved ? "trending_up" : "horizontal_rule"} style={{ fontSize: 13 }} />
          {improved ? `Improved +${deltaPct}%` : "No improvement found"}
        </span>
      </div>

      <div className="grid grid-cols-1 divide-y divide-outline-variant border-b border-outline-variant sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="flex flex-col gap-1 p-6">
          <span className="mb-1 font-mono text-[10px] font-black uppercase tracking-widest text-outline">
            Before tuning
          </span>
          <span className="font-mono text-4xl font-black text-on-surface-variant">
            {(baseline * 100).toFixed(2)}
            <span className="ml-1 text-base font-bold text-outline">%</span>
          </span>
          <span className="mt-0.5 font-mono text-[11px] text-on-surface-variant">
            Baseline {metric.toUpperCase()} · default params
          </span>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-variant">
            <div className="h-full rounded-full bg-outline/30" style={{ width: `${Math.min(baseline * 100, 100)}%` }} />
          </div>
        </div>
        <div className="flex flex-col gap-1 p-6">
          <span className="mb-1 font-mono text-[10px] font-black uppercase tracking-widest text-success-green">
            After tuning
          </span>
          <span className="font-mono text-4xl font-black text-success-green">
            {(optimized * 100).toFixed(2)}
            <span className="ml-1 text-base font-bold text-success-green/70">%</span>
          </span>
          <span className="mt-0.5 font-mono text-[11px] text-on-surface-variant">
            Optimized {metric.toUpperCase()} · best params
          </span>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-variant">
            <div className="h-full rounded-full bg-success-green" style={{ width: `${Math.min(optimized * 100, 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left font-sans text-sm">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low text-on-surface-variant">
              <th className="w-20 whitespace-nowrap p-3 text-center text-xs font-bold uppercase tracking-wider">Trial</th>
              <th className="hidden whitespace-nowrap p-3 text-xs font-bold uppercase tracking-wider sm:table-cell">
                Parameters tested
              </th>
              <th className="w-28 whitespace-nowrap p-3 text-center text-xs font-bold uppercase tracking-wider">Score</th>
              <th className="whitespace-nowrap p-3 text-xs font-bold uppercase tracking-wider">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((t, idx) => {
              const isBaseline = t.trial === 0;
              const isBest = !isBaseline && Math.abs(t.score - optimized) < 0.00005 && improved;
              let paramEntries: Array<[string, string]> = [];
              let paramFallback = "";
              if (!isBaseline) {
                try {
                  const obj = JSON.parse(t.parameters) as Record<string, unknown>;
                  paramEntries = Object.entries(obj).map(([k, v]) => [k, String(v)]);
                } catch {
                  paramFallback = t.parameters;
                }
              }
              return (
                <tr
                  key={idx}
                  className={cn(
                    "border-b border-outline-variant/40 transition-colors last:border-0",
                    isBest ? "bg-surface-green-tint" : "hover:bg-surface-container-low"
                  )}
                >
                  <td className="p-3 text-center align-middle">
                    <span
                      className={cn(
                        "font-mono font-bold",
                        isBaseline ? "text-primary" : isBest ? "text-success-green" : "text-on-surface-variant"
                      )}
                    >
                      #{t.trial}
                    </span>
                  </td>
                  <td className="hidden p-3 align-middle sm:table-cell">
                    {isBaseline ? (
                      <span className="font-mono italic text-primary">Model defaults</span>
                    ) : paramEntries.length > 0 ? (
                      <span className="flex flex-wrap gap-1.5">
                        {paramEntries.map(([k, v]) => (
                          <span
                            key={k}
                            className={cn(
                              "inline-flex items-baseline gap-1 whitespace-nowrap rounded-md px-2.5 py-1 font-mono text-xs",
                              isBest
                                ? "border border-success-green/20 bg-surface-green-tint"
                                : "btn-glass"
                            )}
                          >
                            <span className={cn("font-bold", isBest ? "text-success-green" : "text-primary")}>
                              {k}
                            </span>
                            <span className="text-outline">=</span>
                            <span className="font-semibold text-on-background">{v}</span>
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="break-all font-mono text-on-surface-variant">{paramFallback}</span>
                    )}
                  </td>
                  <td className="p-3 text-center align-middle font-mono font-bold">
                    <span
                      className={cn(
                        isBest ? "text-success-green" : isBaseline ? "text-primary" : "text-on-surface"
                      )}
                    >
                      {(t.score * 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="p-3 align-middle">
                    <span
                      title={t.result}
                      className={cn(
                        "block whitespace-normal break-words font-medium leading-relaxed",
                        isBaseline && "font-semibold text-primary",
                        t.result.toLowerCase().includes("new champion") && "font-bold text-success-green",
                        t.result.toLowerCase().includes("error") && "text-error",
                        !isBaseline &&
                          !t.result.toLowerCase().includes("new champion") &&
                          !t.result.toLowerCase().includes("error") &&
                          "text-on-surface-variant"
                      )}
                    >
                      {isBaseline ? "Baseline: champion from the initial leaderboard sweep" : t.result}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NamthegResult({ runId }: { runId: string }) {
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [plotLoaded, setPlotLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const tryFetch = async () => {
      try {
        const r = await getResult(runId);
        if (cancelled) return;
        setResult(r);
        setLoading(false);
        if (interval) clearInterval(interval);
      } catch {
        // Result not ready yet; fall back to polling status. The run might
        // still be queued/running, in which case we wait and retry.
        try {
          const s = await getStatus(runId);
          if (cancelled) return;
          if (s.status === "failed") {
            setResult({ run_id: runId, status: "failed", error: s.error ?? "Run failed" });
            setLoading(false);
            if (interval) clearInterval(interval);
          }
        } catch {
          /* transient; keep polling */
        }
      }
    };

    tryFetch();
    interval = setInterval(tryFetch, 2000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [runId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Icon name="sync" className="animate-spin text-primary" style={{ fontSize: 36 }} />
          <p className="font-mono text-sm font-semibold text-on-surface-variant">
            Loading model analysis...
          </p>
        </div>
      </div>
    );
  }

  if (!result || result.status === "failed") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Icon name="error_outline" className="animate-pulse text-error" style={{ fontSize: 52 }} />
        <p className="max-w-md text-center font-mono text-sm font-semibold text-on-surface-variant">
          {result?.error ?? "No model metrics generated."}
        </p>
        <Link
          href="/namtheg"
          className="rounded-lg border border-outline-variant px-5 py-2.5 text-xs font-bold text-primary transition-all hover:bg-surface-purple-tint"
        >
          Start a new run
        </Link>
      </div>
    );
  }

  const extra = result.extra ?? {};
  const features = extra.top_features ?? [];
  const models = [...(extra.all_models ?? [])].sort((a, b) => b.cv_mean - a.cv_mean);
  const trainScore = extra.train_accuracy ?? extra.train_r2;
  const modelName = result.model_name ?? "Best model";
  const score = result.accuracy_score ?? 0;
  const metric = result.score_metric ?? "score";
  const pct = Math.max(0, Math.min(100, score * 100));
  const isRegression = metric === "r2";
  const isClassification = result.problem_type === "classification";

  return (
    <div className="flex-1 overflow-y-auto px-gutter py-12">
      <div className="mx-auto w-full max-w-container-max space-y-8">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="mb-2 text-headline-lg font-bold text-on-background">
              Performance analytics
            </h1>
            <p className="text-body-md text-on-surface-variant">
              Model performance for predicting{" "}
              <strong className="font-bold text-primary">{result.target}</strong> with{" "}
              <strong className="font-bold text-primary">{modelName}</strong>.
            </p>
          </div>
          <Link
            href="/namtheg"
            className="btn-glass flex w-fit items-center gap-1.5 rounded-lg px-4 py-2 text-xs"
          >
            <Icon name="refresh" style={{ fontSize: 15 }} />
            New run
          </Link>
        </header>

        {/* Champion badge */}
        <section className="glass flex flex-col gap-3 p-6 text-left">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-purple-tint">
              <Icon name="workspace_premium" className="text-primary" style={{ fontSize: 22 }} />
            </span>
            <h2 className="truncate text-2xl font-black text-on-surface">{modelName}</h2>
          </div>
          {result.justification && (
            <p className="text-sm font-medium leading-relaxed text-on-surface-variant">
              {result.justification}
            </p>
          )}
        </section>

        {/* Inference CTA */}
        <Link
          href={`/namtheg/${runId}/inference`}
          className="glass glass-hover group flex w-full items-center gap-4 p-6 text-left"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-purple-tint transition-transform group-hover:scale-105">
            <Icon name="rocket_launch" className="text-primary" style={{ fontSize: 22 }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-headline-md font-bold text-on-background">
              Try this model
            </span>
            <span className="mt-0.5 block text-xs font-medium text-on-surface-variant">
              Send live predictions to the trained champion from the Inference page.
            </span>
          </span>
          <span className="btn-primary shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold">
            Try now
            <Icon
              name="arrow_forward"
              className="transition-transform group-hover:translate-x-0.5"
              style={{ fontSize: 16 }}
            />
          </span>
        </Link>

        {/* Accuracy + features (left), plot (right) */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {features.length > 0 ? (
            <AccuracyAndFeaturesCard
              features={features}
              accuracyPct={pct}
              accuracyLabel={isRegression ? "R² regression score" : "Cross-validation accuracy"}
              trainScore={trainScore}
              overfitGap={extra.overfit_gap}
            />
          ) : (
            <div className="glass flex min-h-[280px] flex-col items-center justify-center p-6">
              <Icon name="bar_chart" className="text-outline opacity-40" style={{ fontSize: 48 }} />
              <p className="mt-3 font-mono text-sm font-bold text-on-surface-variant">
                Feature diagnostics not available for this model type
              </p>
            </div>
          )}

          <div className="glass flex h-full flex-col p-6 text-left">
            <h3 className="mb-6 text-headline-md font-bold text-on-background">
              {isClassification ? "Confusion matrix" : "Predicted vs actual"}
            </h3>
            <div className="relative min-h-[220px] flex-1 overflow-hidden rounded-lg">
              {!plotLoaded && <div className="shimmer absolute inset-0" />}
              {/* The plot is served through the authenticated proxy from D1. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={plotUrl(runId)}
                alt={isClassification ? "Confusion matrix plot" : "Predicted vs actual plot"}
                className={cn(
                  "h-full w-full object-contain transition-opacity duration-500",
                  plotLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setPlotLoaded(true)}
              />
            </div>
            <p className="mt-3 font-mono text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              {isClassification
                ? "Diagonal = correct predictions; bright cyan cells indicate accurate validation."
                : "Tighter clusters along the diagonal indicate smaller residuals."}
            </p>
          </div>
        </section>

        {extra.tuning_trials && extra.tuning_trials.length > 1 && (
          <TuningResultsCard
            trials={extra.tuning_trials}
            baseline={extra.tuning_trials[0].score}
            optimized={score}
            metric={metric}
            modelName={modelName}
          />
        )}

        {models.length > 0 && (
          <section className="glass overflow-hidden text-left">
            <div className="flex flex-col justify-between gap-1 border-b border-outline-variant bg-surface-container-low p-5 sm:flex-row sm:items-center">
              <h3 className="text-headline-md font-bold text-on-background">
                Model comparison leaderboard
              </h3>
              <span className="font-mono text-xs font-bold text-on-surface-variant">
                Ranked by cross-validation mean
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left font-sans text-sm">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container-low text-on-surface-variant">
                    <th className="w-20 p-5 text-xs font-bold uppercase tracking-wider">#</th>
                    <th className="p-5 text-xs font-bold uppercase tracking-wider">Model</th>
                    <th className="p-5 text-center text-xs font-bold uppercase tracking-wider">CV std</th>
                    <th className="p-5 text-center text-xs font-bold uppercase tracking-wider">CV mean</th>
                    <th className="hidden p-5 text-center text-xs font-bold uppercase tracking-wider sm:table-cell">
                      {isRegression ? "Test R²" : "Test acc"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m, i) => {
                    const isWinner = m.name === modelName;
                    return (
                      <tr
                        key={m.name}
                        className="border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-surface-container-low"
                      >
                        <td className={cn("p-5 font-mono font-bold", isWinner && "text-primary")}>{i + 1}</td>
                        <td className={cn("p-5 font-mono font-bold", isWinner ? "text-primary" : "text-on-surface")}>
                          {m.name}
                        </td>
                        <td className={cn("p-5 text-center font-mono", isWinner ? "text-primary" : "text-on-surface-variant")}>
                          ± {m.cv_std.toFixed(4)}
                        </td>
                        <td className={cn("p-5 text-center font-mono", isWinner ? "text-primary" : "text-on-surface-variant")}>
                          {(m.cv_mean * 100).toFixed(2)}%
                        </td>
                        <td className={cn("hidden p-5 text-center font-mono sm:table-cell", isWinner ? "text-primary" : "text-on-surface-variant")}>
                          {isWinner ? `${(score * 100).toFixed(1)}%` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
