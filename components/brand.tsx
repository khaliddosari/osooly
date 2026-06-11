import React from "react";
import { cn } from "@/lib/utils";

/** OpenType feature set that lights up the Thmanyah serif ligatures/stylistic sets. */
const THMANYAH_FEATURES: React.CSSProperties = {
  fontFeatureSettings:
    '"liga" 1, "dlig" 1, "clig" 1, "calt" 1, "salt" 1, "ss01" 1, "ss02" 1, "ss03" 1, "ss04" 1, "ss05" 1',
  textRendering: "optimizeLegibility",
};

/**
 * The product wordmark — أصولي ("my assets"). Always rendered in the Thmanyah
 * display serif, bold, accent cyan (design-system hard rule §8.5).
 */
export function Brand({ className }: { className?: string }) {
  return (
    <span
      lang="ar"
      dir="rtl"
      style={THMANYAH_FEATURES}
      className={cn(
        "font-display font-bold inline-flex items-center text-primary text-[1.22em] leading-none",
        className
      )}
    >
      أصولي
    </span>
  );
}

/**
 * Bilingual brand lockup — Arabic wordmark above the Latin name, per the
 * design system's bilingual-identity rule (Arabic always on top).
 */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex flex-col items-center leading-none", className)}>
      <Brand className="text-[1.45em]" />
      <span className="mt-1 text-[0.62em] font-semibold uppercase tracking-[0.22em] indent-[0.22em] text-on-surface-variant">
        Osooly
      </span>
    </span>
  );
}
