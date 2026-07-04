"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Global error boundary (S10): the last resort when the root layout itself
 * fails, so it must render its own <html>/<body>. The app chrome and Font
 * Awesome aren't available here, so this stays deliberately minimal: dark
 * surface, glass card, plain text, one recover button.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        event: "ui.global_error",
        message: error.message,
        digest: error.digest ?? null,
      })
    );
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-surface text-on-surface antialiased">
        <div className="flex min-h-dvh items-center justify-center px-6">
          <div className="glass flex max-w-md flex-col items-center gap-5 px-10 py-12 text-center">
            <h1 className="text-headline-md font-bold text-on-surface">
              Osooly hit an unexpected error
            </h1>
            <p className="text-body-md text-on-surface-variant">
              The app failed to load this page. Reloading usually clears it.
            </p>
            {error.digest && (
              <p className="font-mono text-label-sm text-on-surface-variant">
                ref: {error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              className="btn-primary rounded-lg px-6 py-3 text-label-md"
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
