import type { PoliteFetcher } from "../polite-fetch";
import { extractPrices, slugify, summarize } from "../scrape-stats";
import { AdapterError, type SnapshotWrite } from "../types";

/**
 * Syarah used-car listings (PRD §3.5): scraped nightly per user-saved
 * make/model through the PoliteFetcher (robots.txt, ≤1 req/s, Osooly UA —
 * PRD §3.5a rule 3). Search URLs and markup are best-effort and may need
 * re-pinning when the site changes; everything downstream only sees
 * SnapshotWrite, so fixes stay inside this file.
 */
export const SYARAH_ADAPTER_ID = "syarah";

/** Plausible used-car price band, SAR. */
const PRICE_BAND = { min: 10_000, max: 2_000_000 };

export async function fetchSyarahListing(
  polite: PoliteFetcher,
  make: string,
  model: string
): Promise<SnapshotWrite> {
  const query = encodeURIComponent(`${make} ${model}`);
  const res = await polite.fetch(`https://syarah.com/search?text=${query}`);
  if (!res.ok) {
    throw new AdapterError(SYARAH_ADAPTER_ID, `HTTP ${res.status}`);
  }
  const stats = summarize(extractPrices(await res.text(), PRICE_BAND));
  if (!stats) {
    throw new AdapterError(
      SYARAH_ADAPTER_ID,
      `no listings parsed for ${make} ${model}`
    );
  }
  return {
    assetClass: "autos",
    symbol: slugify(make, model),
    price: stats.median,
    currency: "SAR",
    payload: { ...stats, make, model },
    source: SYARAH_ADAPTER_ID,
  };
}
