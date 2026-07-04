"use client";

import { useEffect } from "react";
import { Icon } from "@/components/icon";

/**
 * Shared fallback for the App Router error boundaries (S10). A thrown render or
 * data error becomes this glass card with a retry button instead of a blank
 * crash (PRD §3.9 robustness). The error is logged once as a structured event;
 * `digest` is Next's server-side error id, safe to show for support without
 * leaking the message.
 */
export function ErrorView({
  error,
  reset,
  title = "Something went wrong",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        event: "ui.error",
        message: error.message,
        digest: error.digest ?? null,
      })
    );
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section-gap">
      <div className="glass flex max-w-md flex-col items-center gap-5 px-10 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-error">
          <Icon name="error" style={{ fontSize: 22 }} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-headline-md font-bold text-on-surface">{title}</h1>
          <p className="text-body-md text-on-surface-variant">
            An unexpected error interrupted this page. Your data is safe; try
            again, or head back to the dashboard.
          </p>
          {error.digest && (
            <p className="font-mono text-label-sm text-on-surface-variant">
              ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="btn-primary rounded-lg px-6 py-3 text-label-md"
          >
            <Icon name="refresh" style={{ fontSize: 16 }} />
            Try again
          </button>
          <a href="/dashboard" className="btn-glass rounded-lg px-6 py-3 text-label-md">
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
