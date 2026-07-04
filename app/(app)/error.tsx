"use client";

import { ErrorView } from "@/components/error-view";

/**
 * Segment error boundary for the signed-in app pages (S10). Scoped to the
 * (app) group so a failure in one page (dashboard, assets, namtheg, …) shows
 * the recover-able fallback while the header, footer, and ambient shell stay
 * intact.
 */
export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorView error={error} reset={reset} />;
}
