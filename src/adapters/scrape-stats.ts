/**
 * Shared helpers for the HTML scrapers (Syarah, Haraj, Aqar). Listing pages
 * are JS-heavy and redesign often, so instead of brittle CSS selectors the
 * scrapers extract every SAR-looking number in a plausible price band and
 * summarise. The band plus the median keep one weird hit from skewing the
 * snapshot; a page with too few hits is treated as a failed scrape so the
 * degradation path (stale badge) kicks in rather than a bogus price.
 */

export interface ListingStats {
  median: number;
  min: number;
  max: number;
  sampleCount: number;
}

/**
 * Pull numbers like "245,000", "245٬000", or "245000 ريال" out of markup,
 * keeping only those inside [band.min, band.max].
 */
export function extractPrices(
  html: string,
  band: { min: number; max: number }
): number[] {
  const matches = html.matchAll(/\d{1,3}(?:[,٬]\d{3})+|\d{4,9}/g);
  const prices: number[] = [];
  for (const match of matches) {
    const value = Number(match[0].replace(/[,٬]/g, ""));
    if (Number.isFinite(value) && value >= band.min && value <= band.max) {
      prices.push(value);
    }
  }
  return prices;
}

export function summarize(prices: number[]): ListingStats | null {
  // Fewer than 3 in-band numbers means we likely scraped chrome, not
  // listings — report failure instead of a fake market price.
  if (prices.length < 3) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    sampleCount: sorted.length,
  };
}

/** "Toyota", "Land Cruiser" → "toyota-land-cruiser" (snapshot symbol part). */
export function slugify(...parts: string[]): string {
  return parts
    .join(" ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "");
}
