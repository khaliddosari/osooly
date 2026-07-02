"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { getStatus } from "@/lib/namtheg/api";
import { cn } from "@/lib/utils";

/**
 * The pipeline console (PRD 3.7 running step). The six cells mirror the
 * sidecar's fixed pipeline order; cell progression is timer-driven theater
 * while the real run status is polled from D1 every few seconds. The poll
 * result is authoritative: success completes every cell, failure freezes
 * the active one.
 */
const STEPS = [
  {
    key: "profile",
    fn: "profile_dataset(run_id)",
    label: "Profile dataset",
    icon: "database",
    lines: [
      "[SYSTEM] Initializing reader buffers...",
      "[INFO] Scanning dtypes and distinct cardinality counts",
      "[INFO] Evaluating missing-value frequency per feature",
      "[SUCCESS] Profiling complete. Dataset parsed successfully.",
    ],
  },
  {
    key: "detect",
    fn: "detect_problem_type(run_id, target)",
    label: "Detect problem type",
    icon: "target",
    lines: [
      "[SYSTEM] Fetching configured target column...",
      "[INFO] Counting unique values in target labels",
      "[INFO] Evaluating cardinality threshold limit",
      "[SUCCESS] Problem type successfully determined.",
    ],
  },
  {
    key: "eda",
    fn: "run_eda(run_id, target)",
    label: "Explore the data",
    icon: "bar_chart",
    lines: [
      "[SYSTEM] Launching analytical profiler...",
      "[INFO] Computing numeric summaries (mean, std, min, max)",
      "[INFO] Computing Pearson correlations with the target",
      "[SUCCESS] EDA statistical report saved.",
    ],
  },
  {
    key: "feature_engineer",
    fn: "feature_engineer(run_id, target)",
    label: "Engineer features",
    icon: "build",
    lines: [
      "[SYSTEM] Booting preprocessing transformers...",
      "[INFO] Dropping columns with >50% missing values",
      "[INFO] Removing ID-like features (>=95% unique)",
      "[INFO] Planning one-hot / ordinal encodings per cardinality",
      "[SUCCESS] Engineered feature space saved.",
    ],
  },
  {
    key: "train",
    fn: "train_model(run_id, target, problem_type)",
    label: "Train & compare models",
    icon: "model_training",
    lines: [
      "[SYSTEM] Allocating model candidate cache...",
      "[INFO] Splitting dataset into 80% train / 20% test",
      "[INFO] Cross-validating RandomForest, ExtraTrees, GradientBoosting...",
      "[INFO] Cross-validating linear and KNN baselines...",
      "[INFO] Selecting champion architecture by CV mean",
      "[SUCCESS] Training phase completed. Champion selected.",
    ],
  },
  {
    key: "visualize",
    fn: "generate_visualization(run_id, target, problem_type)",
    label: "Generate results",
    icon: "insights",
    lines: [
      "[SYSTEM] Rendering performance engine...",
      "[INFO] Computing evaluation plot from held-out predictions",
      "[INFO] Running the agentic fine-tuning loop...",
      "[SUCCESS] Result report persisted to D1.",
    ],
  },
] as const;

// Rough wall-time per cell before the theater advances on its own; the last
// cell holds until the real status poll reports success.
const STEP_DURATIONS = [3200, 2800, 3600, 3000, 9000, 6000];

type StepStatus = "waiting" | "active" | "done" | "error";

function statusFor(index: number, activeStep: number, failed: boolean): StepStatus {
  if (failed && activeStep === index) return "error";
  if (activeStep > index) return "done";
  if (activeStep === index) return "active";
  return "waiting";
}

function ConsoleLine({ line, last }: { line: string; last: boolean }) {
  const isSuccess = line.startsWith("[SUCCESS]");
  const isSystem = line.startsWith("[SYSTEM]");
  const text = line.replace(/^\[[A-Z]+\]\s*/, "");
  return (
    <p className="leading-relaxed text-on-surface-variant animate-fade-up">
      <span
        className={cn(
          "mr-1.5 font-bold",
          isSuccess ? "text-success-green" : isSystem ? "text-primary" : "text-info-blue"
        )}
      >
        {isSuccess ? "[SUCCESS]" : isSystem ? "[SYSTEM]" : "[INFO]"}
      </span>
      {text}
      {last && (
        <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-blink rounded-sm bg-primary align-middle" />
      )}
    </p>
  );
}

function PipelineCell({
  step,
  status,
  index,
}: {
  step: (typeof STEPS)[number];
  status: StepStatus;
  index: number;
}) {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (status !== "active") {
      setVisibleLines(0);
      return;
    }
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i++;
      setVisibleLines(i);
      if (i < step.lines.length) timer = setTimeout(tick, 350 + Math.random() * 250);
    };
    timer = setTimeout(tick, 200);
    return () => clearTimeout(timer);
  }, [status, step.lines.length]);

  const showOutput = status === "active" || status === "error";
  const lines = step.lines.slice(0, status === "active" ? visibleLines : step.lines.length);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-surface-container-lowest transition-opacity",
        status === "waiting" && "border-outline-variant opacity-40",
        status === "active" && "border-primary/40",
        status === "done" && "border-success-green/40",
        status === "error" && "border-error/40"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b px-3.5 py-2",
          status === "active" && "border-primary/20 bg-surface-purple-tint/50",
          status === "done" && "border-success-green/20 bg-surface-green-tint/30",
          status === "error" && "border-error/20 bg-error-container/30",
          status === "waiting" && "border-outline-variant bg-surface-container"
        )}
      >
        <span
          className={cn(
            "w-9 shrink-0 font-mono text-[10px]",
            status === "active"
              ? "text-primary"
              : status === "done"
                ? "text-success-green"
                : status === "error"
                  ? "text-error"
                  : "text-outline"
          )}
        >
          In [{status === "done" ? index + 1 : status === "active" ? "*" : status === "error" ? "!" : " "}]:
        </span>
        {status === "active" && (
          <Icon name="sync" className="shrink-0 animate-spin text-primary" style={{ fontSize: 13 }} />
        )}
        {status === "done" && (
          <Icon name="check_circle" className="shrink-0 text-success-green" style={{ fontSize: 14 }} />
        )}
        {status === "error" && (
          <Icon name="error" className="shrink-0 text-error" style={{ fontSize: 14 }} />
        )}
        <span className="flex-1 truncate font-mono text-xs text-on-surface">
          <span className="font-bold text-primary">{step.fn.split("(")[0]}</span>
          <span className="text-outline">(</span>
          <span className="font-semibold text-warning-orange">
            {step.fn.split("(")[1]?.replace(")", "")}
          </span>
          <span className="text-outline">)</span>
        </span>
        <span className="hidden shrink-0 text-xs font-semibold text-on-surface-variant sm:block">
          {step.label}
        </span>
      </div>

      {showOutput && lines.length > 0 && (
        <div className="space-y-1 border-t border-outline-variant/30 bg-surface-container-low px-3.5 py-2.5 font-mono text-[11px]">
          {lines.map((line, i) => (
            <ConsoleLine key={i} line={line} last={status === "active" && i === lines.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function NamthegRunning({ runId }: { runId: string }) {
  const [activeStep, setActiveStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const runStart = useRef(Date.now());

  useEffect(() => {
    if (isComplete || failed) return;
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - runStart.current) / 1000)),
      1000
    );
    return () => clearInterval(id);
  }, [isComplete, failed]);

  useEffect(() => {
    let stepTimer: ReturnType<typeof setTimeout>;

    const advance = (current: number) => {
      if (current >= STEPS.length - 1) return;
      stepTimer = setTimeout(() => {
        setActiveStep(current + 1);
        advance(current + 1);
      }, STEP_DURATIONS[current] + Math.random() * 1500);
    };
    advance(0);

    const poll = setInterval(async () => {
      try {
        const s = await getStatus(runId);
        if (s.status === "succeeded") {
          clearInterval(poll);
          clearTimeout(stepTimer);
          setActiveStep(STEPS.length);
          setIsComplete(true);
        } else if (s.status === "failed") {
          clearInterval(poll);
          clearTimeout(stepTimer);
          setFailed(true);
          setErrMsg(s.error ?? "Unknown error.");
        }
      } catch {
        /* transient; keep polling */
      }
    }, 3000);

    return () => {
      clearInterval(poll);
      clearTimeout(stepTimer);
    };
  }, [runId]);

  const progressPct = Math.min(100, (activeStep / STEPS.length) * 100);

  return (
    <div className="flex-1 overflow-y-auto px-gutter py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        {/* Console toolbar */}
        <div className="glass flex items-center gap-3 rounded-xl px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-error-pink/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning-orange/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success-green/70" />
          </div>
          <span className="ml-2 hidden flex-1 truncate font-mono text-xs font-bold text-on-surface-variant sm:block">
            namtheg_{runId.slice(0, 8)}.ipynb
          </span>
          <span className="ml-auto rounded-full bg-surface-container-low px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-on-surface-variant">
            {elapsed}s
          </span>
          {!failed && !isComplete && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-primary">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Running
            </span>
          )}
          {isComplete && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-success-green">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-green" />
              Ready
            </span>
          )}
          {failed && (
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-error">
              <span className="h-1.5 w-1.5 rounded-full bg-error" />
              Failed
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-variant">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPct}%`, background: "var(--accent-gradient)" }}
          />
        </div>

        {/* Pipeline cells */}
        {STEPS.map((step, i) => (
          <PipelineCell key={step.key} step={step} index={i} status={statusFor(i, activeStep, failed)} />
        ))}

        {isComplete && (
          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-success-green/30 bg-surface-green-tint/25 p-5 animate-fade-up sm:flex-row">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-success-green/30 bg-surface-green-tint">
                <Icon name="check_circle" className="text-success-green" style={{ fontSize: 20 }} />
              </span>
              <div>
                <p className="text-sm font-bold text-on-surface">All pipeline stages completed</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Champion model selected and metrics written to your ledger.
                </p>
              </div>
            </div>
            <Link
              href={`/namtheg/${runId}/result`}
              className="btn-primary shrink-0 rounded-lg px-6 py-2.5 text-sm font-bold"
            >
              View results
              <Icon name="arrow_forward" style={{ fontSize: 16 }} />
            </Link>
          </div>
        )}

        {failed && (
          <div className="space-y-1.5 rounded-xl border border-error/20 bg-error-container px-4 py-3 animate-fade-up">
            <p className="text-xs font-bold text-error">Run execution failed</p>
            <p className="text-[11px] leading-relaxed text-on-surface-variant">{errMsg}</p>
            <Link href="/namtheg" className="inline-block text-[11px] font-bold text-primary hover:underline">
              Start over
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
