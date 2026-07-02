"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { getPreview, startRun, type PreviewData } from "@/lib/namtheg/api";
import { cn } from "@/lib/utils";

interface ColumnStats {
  column: string;
  type: "numeric" | "categorical";
  mean: string;
  std: string;
  min: string;
  max: string;
  nullPct: string;
  cardinality: number;
}

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "" || String(v).trim() === "-";
}

export function NamthegPreview({ runId }: { runId: string }) {
  const router = useRouter();
  const [data, setData] = useState<PreviewData | null>(null);
  const [target, setTarget] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"data" | "stats">("data");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    getPreview(runId)
      .then((d) => {
        setData(d);
        if (d.columns?.length) setTarget(d.columns[d.columns.length - 1]);
      })
      .catch((err) => setError(err.message || "Failed to load preview."));
  }, [runId]);

  async function handleStart() {
    if (!target || starting) return;
    setStarting(true);
    setError(null);
    try {
      await startRun(runId, target);
      router.push(`/namtheg/${runId}/running`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start run.");
      setStarting(false);
    }
  }

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          {error ? (
            <>
              <Icon name="error_outline" className="text-error" style={{ fontSize: 36 }} />
              <p className="max-w-md text-center font-mono text-sm font-semibold text-on-surface-variant">
                {error}
              </p>
            </>
          ) : (
            <>
              <Icon name="sync" className="animate-spin text-primary" style={{ fontSize: 36 }} />
              <p className="font-mono text-sm font-semibold text-on-surface-variant">
                Compiling dataset metrics...
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const numericCols = data.columns.filter((col) => {
    const val = data.preview[0]?.[col];
    return (
      typeof val === "number" ||
      (typeof val === "string" && !isNaN(Number(val)) && val.trim() !== "")
    );
  });
  const catCols = data.columns.filter((col) => !numericCols.includes(col));

  const summaryStats: ColumnStats[] = data.columns.map((col) => {
    const values = data.preview.map((row) => row[col]);
    const validNums = values.map((v) => Number(v)).filter((n) => !isNaN(n));
    const nullsCount = values.filter(isBlank).length;
    const nullPct = ((nullsCount / Math.max(1, values.length)) * 100).toFixed(1);
    const uniqueVals = new Set(values.filter((v) => !isBlank(v))).size;

    if (numericCols.includes(col) && validNums.length > 0) {
      const mean = validNums.reduce((a, b) => a + b, 0) / validNums.length;
      const variance =
        validNums.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validNums.length;
      return {
        column: col,
        type: "numeric",
        mean: mean.toFixed(2),
        std: Math.sqrt(variance).toFixed(2),
        min: Math.min(...validNums).toFixed(2),
        max: Math.max(...validNums).toFixed(2),
        nullPct: `${nullPct}%`,
        cardinality: uniqueVals,
      };
    }
    return {
      column: col,
      type: "categorical",
      mean: "N/A",
      std: "N/A",
      min: "N/A",
      max: "N/A",
      nullPct: `${nullPct}%`,
      cardinality: uniqueVals,
    };
  });

  const totalCells = data.preview.length * data.columns.length;
  const nullCells = data.columns.reduce(
    (acc, col) => acc + data.preview.filter((row) => isBlank(row[col])).length,
    0
  );
  const healthScore =
    totalCells > 0 ? Math.round(((totalCells - nullCells) / totalCells) * 100) : 100;
  const healthColor =
    healthScore >= 90
      ? "text-success-green"
      : healthScore >= 70
        ? "text-warning-orange"
        : "text-error";
  const healthBarColor =
    healthScore >= 90
      ? "bg-success-green"
      : healthScore >= 70
        ? "bg-warning-orange"
        : "bg-error";

  const filteredRows = data.preview.filter((row) =>
    data.columns.some((col) =>
      String(row[col] ?? "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  );
  const numericPct = data.n_columns > 0 ? (numericCols.length / data.n_columns) * 100 : 0;

  return (
    <div className="flex-1 overflow-y-auto px-gutter py-12">
      <div className="mx-auto w-full max-w-container-max space-y-8">
        <header>
          <h1 className="text-headline-lg font-bold text-on-background">
            Dataset: {data.filename ?? runId.slice(0, 16)}
          </h1>
          <p className="mt-2 text-body-lg text-on-surface-variant">
            Feature breakdown, data quality, and the prediction target for training.
          </p>
        </header>

        {/* Bento summary cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="glass col-span-1 flex min-h-[200px] flex-col justify-between p-6 lg:col-span-6">
            <div className="flex items-start gap-3">
              <Icon
                name="target"
                className="shrink-0 rounded-lg bg-surface-purple-tint p-3 text-primary"
                style={{ fontSize: 22 }}
              />
              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-primary">
                  Prediction goal
                </span>
                <h2 className="text-headline-md font-bold text-on-background">Target variable</h2>
              </div>
            </div>
            <div className="mt-4">
              <p className="break-words font-mono text-2xl font-black text-primary">
                {target || "Select target..."}
              </p>
              <p className="mt-1.5 text-xs text-on-surface-variant">
                The column the model will learn to predict.
              </p>
            </div>
          </div>

          <div className="glass col-span-1 flex flex-col justify-between p-6 lg:col-span-3">
            <div className="flex items-start gap-3">
              <Icon
                name="health_and_safety"
                className="shrink-0 rounded-lg bg-surface-green-tint p-3 text-success-green"
                style={{ fontSize: 22 }}
              />
              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-outline">
                  Quality scan
                </span>
                <h2 className="text-headline-md font-bold text-on-background">Data health</h2>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-baseline gap-1.5">
                <span className={cn("font-mono text-3xl font-black leading-none", healthColor)}>
                  {healthScore}%
                </span>
                <span className="text-xs font-semibold text-on-surface-variant">of cells filled</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-variant">
                <div className={cn("h-full rounded-full", healthBarColor)} style={{ width: `${healthScore}%` }} />
              </div>
              <p className="mt-3 font-mono text-[11px] font-bold uppercase tracking-wider text-outline">
                {nullCells} null {nullCells === 1 ? "cell" : "cells"} in the sample
              </p>
            </div>
          </div>

          <div className="glass col-span-1 flex flex-col justify-between p-6 lg:col-span-3">
            <div className="flex items-start gap-3">
              <Icon
                name="category"
                className="shrink-0 rounded-lg bg-surface-purple-tint p-3 text-info-blue"
                style={{ fontSize: 22 }}
              />
              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-outline">
                  Dimension
                </span>
                <h2 className="text-headline-md font-bold text-on-background">Feature space</h2>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-baseline">
                <span className="font-mono text-3xl font-black leading-none text-info-blue">
                  {data.n_columns}
                </span>
                <span className="ml-1 text-xs font-semibold text-on-surface-variant">columns</span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-variant">
                <div className="h-full bg-info-blue" style={{ width: `${numericPct}%` }} />
                <div className="h-full bg-warning-orange" style={{ width: `${100 - numericPct}%` }} />
              </div>
              <div className="mt-3 flex justify-between font-mono text-[11px] font-bold uppercase tracking-wider">
                <span className="text-info-blue">{numericCols.length} numeric</span>
                <span className="text-warning-orange">{catCols.length} categorical</span>
              </div>
            </div>
          </div>
        </div>

        {/* Target selection + run */}
        <div className="glass flex flex-wrap items-center gap-4 p-6">
          <div className="flex shrink-0 items-center gap-2">
            <Icon name="target" className="text-primary" />
            <h2 className="whitespace-nowrap text-headline-md font-bold text-on-surface">
              Target variable
            </h2>
          </div>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Target column"
            className="min-w-40 flex-1 cursor-pointer rounded-lg border border-outline-variant bg-surface-variant px-3 py-2.5 text-sm font-semibold text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary [&>option]:bg-[#0e0e16]"
          >
            {data.columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {error && <p className="text-xs font-medium text-error">{error}</p>}
            <button
              onClick={handleStart}
              disabled={!target || starting}
              className={cn(
                "btn-primary rounded-lg px-6 py-3 text-label-md",
                (!target || starting) && "cursor-not-allowed opacity-50"
              )}
            >
              {starting ? "Starting..." : "Run"}
              <Icon
                name={starting ? "sync" : "arrow_forward"}
                className={cn(starting && "animate-spin")}
                style={{ fontSize: 16 }}
              />
            </button>
          </div>
        </div>

        {/* Data table */}
        <div className="glass overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 border-b border-outline-variant bg-surface-container-low p-5">
            <h2 className="text-headline-md font-bold text-on-background">
              {viewMode === "data"
                ? `Dataset preview - first ${data.preview.length} rows`
                : "Feature profiling"}
            </h2>
            <div className="flex rounded-lg border border-outline-variant bg-surface-container-low p-0.5">
              {(["data", "stats"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-bold transition-all",
                    viewMode === mode
                      ? "bg-surface-container-lowest text-primary shadow-sm"
                      : "text-on-surface-variant hover:text-primary"
                  )}
                >
                  {mode === "data" ? "Raw data" : "Summary stats"}
                </button>
              ))}
            </div>
            {viewMode === "data" && (
              <div className="relative ml-auto w-56">
                <Icon
                  name="search"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-outline"
                  style={{ fontSize: 14 }}
                />
                <input
                  className="w-full rounded-lg border border-outline-variant bg-surface-variant py-1.5 pl-9 pr-4 text-xs text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Filter rows..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="max-h-[600px] overflow-auto">
            {viewMode === "data" ? (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container-low">
                    {data.columns.map((col) => (
                      <th
                        key={col}
                        className={cn(
                          "whitespace-nowrap p-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant",
                          col === target && "bg-surface-purple-tint/30 text-primary"
                        )}
                      >
                        <span className="flex items-center gap-1">
                          <Icon
                            name={numericCols.includes(col) ? "tag" : "text_fields"}
                            style={{ fontSize: 11 }}
                          />
                          {col}
                          {col === target && (
                            <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 font-sans text-[8px] font-black uppercase tracking-widest text-on-primary">
                              Target
                            </span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="font-mono text-xs text-on-background">
                  {filteredRows.length > 0 ? (
                    filteredRows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-surface-container-low"
                      >
                        {data.columns.map((col) => (
                          <td
                            key={col}
                            className={cn(
                              "whitespace-nowrap p-4",
                              col === target && "bg-surface-purple-tint/10 font-bold text-primary"
                            )}
                          >
                            {String(row[col] ?? "-")}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={data.columns.length}
                        className="p-8 text-center font-sans text-xs text-on-surface-variant"
                      >
                        No rows matching the filter were found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse text-left font-sans">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container-low text-on-surface-variant">
                    <th className="p-4 text-xs font-bold uppercase tracking-wider">Column</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider">Type</th>
                    <th className="p-4 text-right text-xs font-bold uppercase tracking-wider">Mean</th>
                    <th className="p-4 text-right text-xs font-bold uppercase tracking-wider">Std dev</th>
                    <th className="p-4 text-right text-xs font-bold uppercase tracking-wider">Min</th>
                    <th className="p-4 text-right text-xs font-bold uppercase tracking-wider">Max</th>
                    <th className="p-4 text-right text-xs font-bold uppercase tracking-wider">Null %</th>
                    <th className="p-4 text-right text-xs font-bold uppercase tracking-wider">Cardinality</th>
                  </tr>
                </thead>
                <tbody className="text-xs text-on-background">
                  {summaryStats.map((stat) => (
                    <tr
                      key={stat.column}
                      className={cn(
                        "border-b border-outline-variant/40 transition-colors last:border-0 hover:bg-surface-container-low",
                        stat.column === target && "bg-surface-purple-tint/10"
                      )}
                    >
                      <td className="flex items-center gap-1.5 p-4 font-bold text-on-surface">
                        <Icon
                          name={stat.type === "numeric" ? "tag" : "text_fields"}
                          style={{ fontSize: 11 }}
                        />
                        {stat.column}
                        {stat.column === target && (
                          <span className="ml-1 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-on-primary">
                            Target
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            stat.type === "numeric"
                              ? "bg-surface-purple-tint text-primary"
                              : "bg-secondary-container/20 text-secondary"
                          )}
                        >
                          {stat.type}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-medium text-on-surface-variant">{stat.mean}</td>
                      <td className="p-4 text-right font-mono font-medium text-on-surface-variant">{stat.std}</td>
                      <td className="p-4 text-right font-mono font-medium text-on-surface-variant">{stat.min}</td>
                      <td className="p-4 text-right font-mono font-medium text-on-surface-variant">{stat.max}</td>
                      <td className="p-4 text-right font-mono font-bold text-error">{stat.nullPct}</td>
                      <td className="p-4 text-right font-mono font-bold text-on-surface">{stat.cardinality}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
