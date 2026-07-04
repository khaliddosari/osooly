"use client";

import { ErrorView } from "@/components/error-view";

/**
 * Top-level error boundary (S10): catches errors thrown anywhere under the root
 * layout, rendering the recover-able fallback inside the app shell.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView error={error} reset={reset} />;
}
