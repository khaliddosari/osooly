"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import {
  getModelSchema,
  predict as predictApi,
  type ModelSchema,
  type PredictionResponse,
} from "@/lib/namtheg/api";
import { cn } from "@/lib/utils";

/**
 * The inference step (PRD 3.7). Namtheg deployed each model to Modal and
 * proxied predictions; the port serves them straight from the sidecar's
 * trained bundle, so the model is usable the moment the run succeeds.
 */
export function NamthegInference({ runId }: { runId: string }) {
  const [schema, setSchema] = useState<ModelSchema | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [values, setValues] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"form" | "json">("form");
  const [jsonText, setJsonText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getModelSchema(runId)
      .then((s) => {
        setSchema(s);
        setSchemaError(null);
      })
      .catch((e) => setSchemaError(e instanceof Error ? e.message : String(e)));
  }, [runId]);

  useEffect(() => {
    if (!schema) return;
    const initial: Record<string, string> = {};
    for (const c of schema.feature_cols) {
      const v = schema.sample[c];
      initial[c] = v === null || v === undefined ? "" : String(v);
    }
    setValues(initial);
    setJsonText(JSON.stringify({ features: schema.sample }, null, 2));
  }, [schema]);

  if (schemaError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-gutter">
        <Icon name="hourglass_empty" className="text-outline" style={{ fontSize: 52 }} />
        <h1 className="text-headline-md font-bold text-on-background">No model available yet</h1>
        <p className="max-w-md text-center font-mono text-sm text-on-surface-variant">
          Inference needs a trained model. Finish the training run for this dataset first,
          then come back here.
        </p>
        <div className="flex gap-3">
          <Link
            href={`/namtheg/${runId}/result`}
            className="rounded-lg border border-outline-variant px-5 py-2.5 text-xs font-bold text-primary transition-all hover:bg-surface-purple-tint"
          >
            Back to results
          </Link>
          <Link
            href="/namtheg"
            className="rounded-lg border border-outline-variant px-5 py-2.5 text-xs font-bold text-on-surface-variant transition-all hover:bg-surface-container"
          >
            Start a new run
          </Link>
        </div>
      </div>
    );
  }

  const isClassification = schema?.problem_type === "classification";

  const resetToSample = () => {
    if (!schema) return;
    const initial: Record<string, string> = {};
    for (const c of schema.feature_cols) {
      const v = schema.sample[c];
      initial[c] = v === null || v === undefined ? "" : String(v);
    }
    setValues(initial);
    setError(null);
    setResult(null);
  };

  const runPredict = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let payload: Parameters<typeof predictApi>[1];
      if (mode === "json") {
        try {
          payload = JSON.parse(jsonText);
        } catch (e) {
          throw new Error("Invalid JSON: " + (e instanceof Error ? e.message : String(e)));
        }
      } else {
        const features: Record<string, number | string | null> = {};
        for (const c of schema?.feature_cols ?? []) {
          const raw = values[c];
          if (raw === "" || raw === undefined) {
            features[c] = null;
          } else if (!isNaN(Number(raw))) {
            features[c] = Number(raw);
          } else {
            features[c] = raw;
          }
        }
        payload = { features };
      }
      setResult(await predictApi(runId, payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const topProb = (probs?: number[]) => (probs ? Math.max(...probs) : null);

  return (
    <div className="flex-1 overflow-y-auto px-gutter py-12">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="mb-2 text-headline-lg font-bold text-on-background">Inference</h1>
            <p className="text-body-md text-on-surface-variant">
              <strong className="font-bold text-primary">
                {schema?.model_name ?? "Your model"}
              </strong>{" "}
              is trained and ready. Send it a prediction below.
            </p>
          </div>
          <Link
            href={`/namtheg/${runId}/result`}
            className="btn-glass flex w-fit items-center gap-1.5 rounded-lg px-4 py-2 text-xs"
          >
            <Icon name="analytics" style={{ fontSize: 15 }} />
            Back to results
          </Link>
        </header>

        <section className="glass p-6 text-left">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-purple-tint">
                <Icon name="science" className="text-primary" style={{ fontSize: 24 }} />
              </span>
              <div className="min-w-0">
                <h2 className="text-headline-md font-bold text-on-background">Try the model</h2>
                <p className="mt-0.5 text-xs font-medium text-on-surface-variant">
                  Pre-filled with a sample row; tweak any value to see how the prediction moves.
                </p>
              </div>
            </div>
            {schema && (
              <div className="flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container p-1">
                {(["form", "json"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded px-3 py-1.5 text-xs font-bold transition-colors",
                      mode === m
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant hover:bg-surface-container-high"
                    )}
                  >
                    {m === "form" ? "Form" : "JSON"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!schema ? (
            <div className="mt-5 flex items-center gap-2 text-xs text-on-surface-variant">
              <Icon name="sync" className="animate-spin" style={{ fontSize: 16 }} />
              Loading model schema...
            </div>
          ) : (
            <>
              {mode === "form" ? (
                <div className="mt-5 grid max-h-80 grid-cols-1 gap-3 overflow-y-auto pr-2 sm:grid-cols-2 md:grid-cols-3">
                  {schema.feature_cols.map((c) => (
                    <div key={c} className="flex flex-col">
                      <label
                        htmlFor={`feat-${c}`}
                        className="truncate font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"
                        title={c}
                      >
                        {c}
                      </label>
                      <input
                        id={`feat-${c}`}
                        type="text"
                        value={values[c] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [c]: e.target.value }))}
                        className="mt-1 rounded-md border border-outline-variant bg-surface-container px-2.5 py-1.5 font-mono text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5">
                  <textarea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    rows={10}
                    className="w-full rounded-md border border-outline-variant bg-surface-container px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
                    spellCheck={false}
                    aria-label="Prediction payload JSON"
                  />
                  <p className="mt-1 font-mono text-[10px] text-on-surface-variant">
                    Use{" "}
                    <code className="rounded bg-surface-container px-1 py-0.5">{`{"features": {...}}`}</code>{" "}
                    for a single row, or{" "}
                    <code className="rounded bg-surface-container px-1 py-0.5">{`{"rows": [[...], ...]}`}</code>{" "}
                    for a batch.
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-4">
                {mode === "form" && (
                  <button
                    onClick={resetToSample}
                    className="flex items-center gap-1.5 self-center rounded-lg px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-surface-purple-tint"
                  >
                    <Icon name="restart_alt" style={{ fontSize: 18 }} />
                    Reset to sample
                  </button>
                )}
                <button
                  onClick={runPredict}
                  disabled={busy}
                  className={cn(
                    "btn-primary w-full rounded-lg px-5 py-2.5 text-sm font-bold",
                    busy && "cursor-not-allowed opacity-60"
                  )}
                >
                  <Icon
                    name={busy ? "sync" : "send"}
                    className={cn(busy && "animate-spin")}
                    style={{ fontSize: 18 }}
                  />
                  {busy ? "Predicting..." : "Predict"}
                </button>
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/40 p-3">
                  <Icon name="error" className="shrink-0 text-error" style={{ fontSize: 16 }} />
                  <p className="break-words font-mono text-xs text-error">{error}</p>
                </div>
              )}

              {result && !result.error && (
                <div className="mt-5 rounded-lg border border-outline-variant bg-surface-container p-4">
                  <h3 className="mb-3 text-center font-mono text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Prediction result
                  </h3>
                  {isClassification ? (
                    <div className="space-y-3">
                      {(result.predicted_labels ?? result.predictions ?? []).map((label, i) => {
                        const probs = result.probabilities?.[i];
                        const top = topProb(probs);
                        return (
                          <div key={i} className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-baseline gap-3">
                              <span className="font-mono text-xs font-bold text-on-surface-variant">
                                Predicted:
                              </span>
                              <span className="font-mono text-2xl font-black text-primary">
                                {String(label)}
                              </span>
                              {top !== null && (
                                <span className="font-mono text-xs font-bold text-success-green">
                                  {(top * 100).toFixed(1)}% confidence
                                </span>
                              )}
                            </div>
                            {probs && result.class_labels && (
                              <div className="space-y-1.5">
                                {result.class_labels.map((cls, j) => (
                                  <div key={cls}>
                                    <div className="mb-0.5 flex justify-between font-mono text-[10px] font-bold">
                                      <span className="text-on-surface">{cls}</span>
                                      <span className="text-on-surface-variant">
                                        {(probs[j] * 100).toFixed(2)}%
                                      </span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-variant">
                                      <div
                                        className={cn(
                                          "h-full rounded-full transition-all duration-500",
                                          probs[j] === top ? "bg-primary" : "bg-outline"
                                        )}
                                        style={{ width: `${probs[j] * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2 text-center">
                      {(result.predictions ?? []).map((p, i) => (
                        <div key={i} className="font-mono text-3xl font-black text-primary">
                          {typeof p === "number" ? p.toFixed(4) : String(p)}
                        </div>
                      ))}
                    </div>
                  )}
                  <details className="mt-4">
                    <summary className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary">
                      Raw response
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded border border-outline-variant bg-surface px-3 py-2 font-mono text-[11px]">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </div>
              )}

              {result?.error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/40 p-3">
                  <Icon name="error" className="shrink-0 text-error" style={{ fontSize: 16 }} />
                  <p className="break-words font-mono text-xs text-error">{result.error}</p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
