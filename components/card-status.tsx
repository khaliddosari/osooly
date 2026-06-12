import { Icon } from "@/components/icon";
import type { Freshness } from "@/lib/market-snapshot";
import { cn } from "@/lib/utils";

/**
 * The graceful-degradation badge (PRD §3.5a rule 2): cards keep showing the
 * last-known price and wear this label once a reading ages out of "fresh".
 * Renders nothing for fresh readings, so call sites can attach it
 * unconditionally.
 */
export function FreshnessBadge({
  reading,
  className,
}: {
  reading:
    | { freshness: Freshness; staleLabel: string | null }
    | null
    | undefined;
  className?: string;
}) {
  if (!reading?.staleLabel) return null;
  return (
    <span
      role="status"
      className={cn(
        "max-w-full truncate whitespace-nowrap rounded-full border border-outline-variant bg-surface-container px-2 py-0.5 text-label-sm",
        reading.freshness === "unavailable"
          ? "text-error"
          : "text-warning-orange",
        className
      )}
    >
      {reading.staleLabel}
    </span>
  );
}

/** Whole-card fallback when the card's fetcher itself failed server-side. */
export function CardDataFallback() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <Icon
        name="cloud_off"
        className="text-on-surface-variant"
        style={{ fontSize: 20 }}
      />
      <p className="max-w-xs text-body-md text-on-surface-variant">
        Card data didn&apos;t load. Refresh the page to retry.
      </p>
    </div>
  );
}
