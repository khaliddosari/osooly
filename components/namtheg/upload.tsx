"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { listRuns, uploadCSV, type RunListItem } from "@/lib/namtheg/api";
import { cn } from "@/lib/utils";

const MAX_SIZE = 30 * 1024 * 1024; // 30 MB, mirrors the sidecar's cap

/** Where a run's deep link should land, given how far it got. */
function runHref(run: RunListItem): string {
  switch (run.status) {
    case "uploaded":
      return `/namtheg/${run.id}/preview`;
    case "queued":
    case "running":
      return `/namtheg/${run.id}/running`;
    default:
      return `/namtheg/${run.id}/result`;
  }
}

const STATUS_STYLE: Record<RunListItem["status"], string> = {
  uploaded: "text-on-surface-variant border-outline-variant",
  queued: "text-primary border-primary/30",
  running: "text-primary border-primary/30",
  succeeded: "text-success-green border-success-green/30",
  failed: "text-error border-error/30",
};

export function NamthegUpload({ canUse }: { canUse: boolean }) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunListItem[] | null>(null);

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  useEffect(() => {
    if (!canUse) return;
    listRuns()
      .then(setRuns)
      .catch(() => setRuns([]));
  }, [canUse]);

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setError("Only .csv files are supported right now.");
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("File is too large. Maximum size allowed is 30 MB.");
      return;
    }
    setError(null);
    setFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const res = await uploadCSV(file);
      router.push(`/namtheg/${res.run_id}/preview`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-gutter py-12">
      <div className="mx-auto w-full max-w-4xl flex flex-col gap-8">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="section-title text-headline-md">Namtheg</h1>
          <p className="mt-4 max-w-xl text-body-md text-on-surface-variant">
            Upload a dataset and Namtheg configures and runs the full AutoML
            pipeline: profiling, problem detection, feature engineering,
            model comparison, and agentic fine-tuning.
          </p>
        </header>

        {!canUse && (
          <p
            role="status"
            className="glass px-5 py-4 text-center text-body-md text-warning-orange"
          >
            Sign in with Google to upload datasets and run models.
          </p>
        )}

        {/* Upload card */}
        <div className="glass p-6">
          <h2 className="mb-5 flex items-center gap-2 text-headline-md font-bold text-on-surface">
            <Icon name="upload_file" className="text-primary" />
            Upload dataset
          </h2>

          <div
            className={cn(
              "group relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all duration-300",
              dragging
                ? "border-primary bg-surface-container-low"
                : file
                  ? "border-outline-variant/40"
                  : "border-outline-variant hover:border-primary/50 hover:bg-surface-container-low"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onClick={() => document.getElementById("namtheg-csv-input")?.click()}
          >
            {file ? (
              <>
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-surface-green-tint text-success-green">
                  <Icon name="description" style={{ fontSize: 28 }} />
                </span>
                <h3 className="mb-1 max-w-sm truncate text-headline-md font-bold text-on-surface">
                  {file.name}
                </h3>
                <p className="mb-4 font-mono text-xs text-on-surface-variant">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB · CSV
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setError(null);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-high px-4 py-2 text-xs font-bold text-error transition-all hover:border-error/40 hover:bg-error-container"
                >
                  <Icon name="delete" style={{ fontSize: 14 }} />
                  Remove file
                </button>
              </>
            ) : (
              <>
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-purple-tint">
                  <Icon name="cloud_upload" className="text-primary" style={{ fontSize: 24 }} />
                </span>
                <h3 className="mb-2 text-headline-md font-semibold text-on-surface">
                  Drag &amp; drop your file here
                </h3>
                <p className="mb-5 max-w-md text-center text-body-md text-on-surface-variant">
                  Supported format:{" "}
                  <strong className="font-mono font-semibold text-primary">.CSV</strong>{" "}
                  up to 30 MB. Parsed and validated on upload.
                </p>
                <span className="rounded-lg border border-outline-variant bg-surface-container-high px-5 py-2.5 text-label-md font-semibold text-on-surface transition-all group-hover:border-primary group-hover:text-primary">
                  Browse files
                </span>
              </>
            )}
            <input
              id="namtheg-csv-input"
              type="file"
              accept=".csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {file && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant pt-5 animate-fade-up">
              <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
                <Icon name="auto_awesome" className="shrink-0 text-primary" style={{ fontSize: 16 }} />
                <span>
                  Problem type, feature strategy and missing-value handling are{" "}
                  <strong className="font-semibold text-primary">detected automatically</strong>.
                </span>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <button
                  onClick={handleUpload}
                  disabled={uploading || !canUse}
                  className={cn(
                    "btn-primary rounded-lg px-6 py-2.5 text-label-md",
                    (uploading || !canUse) && "cursor-not-allowed opacity-60"
                  )}
                >
                  <Icon
                    name={uploading ? "sync" : "play_arrow"}
                    className={cn(uploading && "animate-spin")}
                    style={{ fontSize: 16 }}
                  />
                  <span>{uploading ? "Uploading..." : "Start ingestion"}</span>
                </button>
              </div>
            </div>
          )}
          {error && (
            <p className="mt-3 text-xs font-medium text-error" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Recent runs */}
        {canUse && runs !== null && runs.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-label-md uppercase tracking-wider text-on-surface-variant">
              Recent runs
            </h2>
            <ul className="flex flex-col gap-3">
              {runs.map((run) => (
                <li key={run.id}>
                  <Link
                    href={runHref(run)}
                    className="glass glass-hover flex items-center gap-4 px-5 py-4"
                  >
                    <Icon name="database" className="shrink-0 text-on-surface-variant" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-md font-semibold text-on-surface">
                        {run.filename ?? run.id}
                      </span>
                      <span className="block font-mono text-xs text-on-surface-variant">
                        {run.target ? `target: ${run.target} · ` : ""}
                        {run.created_at}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider",
                        STATUS_STYLE[run.status]
                      )}
                    >
                      {run.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
