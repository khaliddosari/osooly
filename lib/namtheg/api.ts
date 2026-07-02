/**
 * Browser-side client for the Namtheg flow (PRD 3.7). Everything goes
 * through the same-origin /api/namtheg proxy; the response shapes mirror
 * the sidecar's endpoints (which kept Namtheg's contracts through the port).
 */

const BASE = "/api/namtheg";

export interface UploadResponse {
  run_id: string;
  filename: string;
  columns: string[];
  preview: Record<string, unknown>[];
}

export interface RunStatus {
  run_id: string;
  status: "uploaded" | "queued" | "running" | "succeeded" | "failed";
  target?: string;
  filename?: string;
  error?: string;
}

export interface RunListItem {
  id: string;
  status: RunStatus["status"];
  filename?: string | null;
  target?: string | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelScore {
  name: string;
  cv_mean: number;
  cv_std: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface TuningTrial {
  trial: number;
  parameters: string;
  score: number;
  result: string;
}

export interface ResultExtra {
  train_accuracy?: number;
  train_r2?: number;
  overfit_gap?: number;
  f1_macro?: number;
  cv_accuracy_mean?: number;
  cv_r2_mean?: number;
  rmse?: number;
  mae?: number;
  n_classes?: number;
  test_size?: number;
  test_score?: number;
  all_models?: ModelScore[];
  top_features?: FeatureImportance[];
  tuning_trials?: TuningTrial[];
}

export interface RunResult {
  run_id: string;
  status: string;
  target?: string;
  problem_type?: "regression" | "classification";
  accuracy_score?: number;
  score_metric?: string;
  plot_path?: string;
  justification?: string;
  model_name?: string;
  extra?: ResultExtra;
  error?: string;
}

export interface PreviewData {
  run_id: string;
  filename?: string;
  columns: string[];
  n_columns: number;
  preview: Record<string, unknown>[];
}

export interface ModelSchema {
  run_id: string;
  model_name?: string;
  problem_type?: "regression" | "classification";
  feature_cols: string[];
  class_labels?: string[] | null;
  sample: Record<string, number | string | null>;
}

export interface PredictionResponse {
  predictions?: (number | string)[];
  predicted_labels?: (string | null)[];
  probabilities?: number[][];
  class_labels?: string[];
  model?: string;
  error?: string;
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { detail?: unknown; error?: unknown };
    const detail = body.detail ?? body.error;
    if (typeof detail === "string") return detail;
  } catch {
    /* not JSON */
  }
  return text || `Request failed (${res.status}).`;
}

async function toJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export async function uploadCSV(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return toJson(await fetch(`${BASE}/upload`, { method: "POST", body: form }));
}

export async function listRuns(): Promise<RunListItem[]> {
  const body = await toJson<{ runs: RunListItem[] }>(await fetch(`${BASE}/runs`));
  return body.runs;
}

export async function getPreview(runId: string): Promise<PreviewData> {
  return toJson(await fetch(`${BASE}/runs/${runId}/preview`));
}

export async function startRun(runId: string, target: string): Promise<RunStatus> {
  return toJson(
    await fetch(`${BASE}/runs/${runId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    })
  );
}

export async function getStatus(runId: string): Promise<RunStatus> {
  return toJson(await fetch(`${BASE}/runs/${runId}/status`));
}

export async function getResult(runId: string): Promise<RunResult> {
  return toJson(await fetch(`${BASE}/runs/${runId}/result`));
}

export function plotUrl(runId: string): string {
  return `${BASE}/runs/${runId}/plot`;
}

export async function getModelSchema(runId: string): Promise<ModelSchema> {
  return toJson(await fetch(`${BASE}/runs/${runId}/model_schema`));
}

export async function predict(
  runId: string,
  payload:
    | { features: Record<string, number | string | null> }
    | { rows: (number | string | null)[][] }
): Promise<PredictionResponse> {
  return toJson(
    await fetch(`${BASE}/runs/${runId}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}
