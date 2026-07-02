import type { CardServerContext } from "@/lib/cards/server-context";
import type { ToolImpl } from "../types";

/**
 * run_automl (PRD 3.7): the cross-class agent tool that lets any card's
 * agent trigger a Namtheg AutoML run on the user's own ledger. The tool
 * exports the user's transactions for one asset class as a CSV, pushes it
 * through the sidecar's upload -> start -> status -> result flow with the
 * internal service token, and returns a compact summary the drafting model
 * can cite (the full report stays one click away on /namtheg).
 *
 * Degradation posture matches the platform (PRD 3.5a rule 2): no sidecar
 * configured, too few rows, or a failed run all come back as data the
 * agent can reason about, never as a thrown error.
 */

export type AssetClass = "stocks" | "real_estate" | "autos" | "jewelry";

export interface RunAutomlInput {
  assetClass: AssetClass;
  /** Column of the exported ledger CSV to predict. Defaults to "price". */
  target?: string;
  /** Poll budget before giving back a still-running handle. 0 = fire and forget. */
  maxWaitSeconds?: number;
}

export type RunAutomlOutcome =
  | { ran: false; reason: string; rows?: number }
  | {
      ran: true;
      runId: string;
      status: "succeeded";
      modelName?: string;
      score?: number;
      scoreMetric?: string;
      justification?: string;
      resultPath: string;
    }
  | { ran: true; runId: string; status: "failed"; error: string }
  | { ran: true; runId: string; status: "running"; note: string; resultPath: string };

export interface AutomlSidecarConfig {
  /** Defaults to NAMTHEG_SIDECAR_URL. */
  baseUrl?: string;
  /** Defaults to NAMTHEG_INTERNAL_TOKEN. */
  internalToken?: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
}

/** Columns of the ledger export; `target` must name one of these. */
const CSV_COLUMNS = [
  "asset_name",
  "symbol",
  "kind",
  "quantity",
  "price",
  "currency",
  "occurred_at",
  "purchase_price",
] as const;

/** Below this many transactions a model would memorize noise, not learn. */
export const MIN_TRAINING_ROWS = 10;

const DEFAULT_WAIT_SECONDS = 120;
const MAX_WAIT_SECONDS = 240;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildLedgerCsv(rows: Record<string, unknown>[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((col) => csvEscape(row[col])).join(","));
  }
  return lines.join("\n");
}

async function ledgerRows(
  ctx: CardServerContext,
  assetClass: AssetClass
): Promise<Record<string, unknown>[]> {
  if (!ctx.userId) return [];
  const { results } = await ctx.db
    .prepare(
      `SELECT a.name AS asset_name, a.symbol AS symbol, t.kind AS kind,
              t.quantity AS quantity, t.price AS price, t.currency AS currency,
              t.occurred_at AS occurred_at, a.purchase_price AS purchase_price
       FROM transactions t
       JOIN assets a ON a.id = t.asset_id
       WHERE t.user_id = ?1 AND a.asset_class = ?2
       ORDER BY t.occurred_at`
    )
    .bind(ctx.userId, assetClass)
    .all<Record<string, unknown>>();
  return results;
}

export function makeRunAutomlTool(
  config: AutomlSidecarConfig = {}
): ToolImpl<RunAutomlInput, RunAutomlOutcome> {
  return {
    name: "run_automl",
    description:
      "Train an AutoML model on the user's own transaction ledger for an asset class (via the Namtheg pipeline) and return the champion model's score and justification. Use it to project values from the user's history, e.g. target='price' on real_estate transactions.",
    inputSchema: {
      type: "object",
      properties: {
        assetClass: {
          type: "string",
          enum: ["stocks", "real_estate", "autos", "jewelry"],
          description: "Asset class whose ledger to train on",
        },
        target: {
          type: "string",
          description: `Ledger column to predict (one of ${CSV_COLUMNS.join(", ")}); default "price"`,
        },
        maxWaitSeconds: {
          type: "number",
          description: "How long to wait for training before returning a running handle",
        },
      },
      required: ["assetClass"],
    },
    async run(ctx, input) {
      const baseUrl = (config.baseUrl ?? process.env.NAMTHEG_SIDECAR_URL ?? "")
        .trim()
        .replace(/\/+$/, "");
      const token = (config.internalToken ?? process.env.NAMTHEG_INTERNAL_TOKEN ?? "").trim();
      if (!baseUrl || !token) {
        return {
          ran: false,
          reason:
            "AutoML sidecar is not configured (NAMTHEG_SIDECAR_URL / NAMTHEG_INTERNAL_TOKEN unset).",
        };
      }
      if (!ctx.userId) {
        return { ran: false, reason: "No signed-in user; AutoML runs are per-user." };
      }

      const target = String(input.target ?? "price").trim() || "price";
      if (!(CSV_COLUMNS as readonly string[]).includes(target)) {
        return {
          ran: false,
          reason: `Target '${target}' is not a ledger column (use one of ${CSV_COLUMNS.join(", ")}).`,
        };
      }

      const rows = await ledgerRows(ctx, input.assetClass);
      if (rows.length < MIN_TRAINING_ROWS) {
        return {
          ran: false,
          rows: rows.length,
          reason: `Only ${rows.length} ${input.assetClass} transactions on the ledger; at least ${MIN_TRAINING_ROWS} are needed to train.`,
        };
      }

      const doFetch = config.fetchImpl ?? fetch;
      const headers = {
        "X-Osooly-Internal-Token": token,
        "X-Osooly-User-Id": ctx.userId,
      };

      const form = new FormData();
      form.append(
        "file",
        new Blob([buildLedgerCsv(rows)], { type: "text/csv" }),
        `${input.assetClass}-ledger.csv`
      );
      const uploadRes = await doFetch(`${baseUrl}/upload`, {
        method: "POST",
        headers,
        body: form,
      });
      if (!uploadRes.ok) {
        return { ran: false, reason: `Upload failed (${uploadRes.status}).` };
      }
      const { run_id: runId } = (await uploadRes.json()) as { run_id: string };
      const resultPath = `/namtheg/${runId}/result`;

      const startRes = await doFetch(`${baseUrl}/runs/${runId}/start`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      if (!startRes.ok) {
        return { ran: true, runId, status: "failed", error: `Start failed (${startRes.status}).` };
      }

      const waitSeconds = Math.max(
        0,
        Math.min(input.maxWaitSeconds ?? DEFAULT_WAIT_SECONDS, MAX_WAIT_SECONDS)
      );
      const pollInterval = config.pollIntervalMs ?? 4000;
      const deadline = Date.now() + waitSeconds * 1000;

      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        const statusRes = await doFetch(`${baseUrl}/runs/${runId}/status`, { headers });
        if (!statusRes.ok) continue;
        const status = (await statusRes.json()) as { status: string; error?: string };
        if (status.status === "failed") {
          return {
            ran: true,
            runId,
            status: "failed",
            error: status.error ?? "Run failed.",
          };
        }
        if (status.status === "succeeded") {
          const resultRes = await doFetch(`${baseUrl}/runs/${runId}/result`, { headers });
          const result = resultRes.ok
            ? ((await resultRes.json()) as {
                model_name?: string;
                accuracy_score?: number;
                score_metric?: string;
                justification?: string;
              })
            : {};
          return {
            ran: true,
            runId,
            status: "succeeded",
            modelName: result.model_name,
            score: result.accuracy_score,
            scoreMetric: result.score_metric,
            justification: result.justification,
            resultPath,
          };
        }
      }

      return {
        ran: true,
        runId,
        status: "running",
        note: `Training is still in progress; the report will appear at ${resultPath}.`,
        resultPath,
      };
    },
  };
}

export const runAutoml = makeRunAutomlTool();
