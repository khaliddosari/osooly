import type { PoliteFetcher } from "../polite-fetch";
import { extractPrices, slugify, summarize } from "../scrape-stats";
import { AdapterError, type SnapshotWrite } from "../types";

/**
 * Aqar.fm scrape — live comparables layered over the official REGA index
 * (PRD §3.5). Scraped through the PoliteFetcher per PRD §3.5a rule 3.
 * City pages are JS-heavy; the band heuristic + median (scrape-stats.ts)
 * stands in for selector parsing, and a failed parse throws so the row
 * ages into the stale badge instead of recording noise.
 */
export const AQAR_ADAPTER_ID = "aqar";

/** Plausible residential listing band, SAR. */
const PRICE_BAND = { min: 100_000, max: 50_000_000 };

export async function fetchAqarCityListing(
  polite: PoliteFetcher,
  city: string
): Promise<SnapshotWrite> {
  const res = await polite.fetch(
    `https://sa.aqar.fm/${encodeURIComponent(slugify(city))}/`
  );
  if (!res.ok) {
    throw new AdapterError(AQAR_ADAPTER_ID, `HTTP ${res.status}`);
  }
  const stats = summarize(extractPrices(await res.text(), PRICE_BAND));
  if (!stats) {
    throw new AdapterError(AQAR_ADAPTER_ID, `no listings parsed for ${city}`);
  }
  return {
    assetClass: "real_estate",
    symbol: `${slugify(city)}:aqar`,
    price: stats.median,
    currency: "SAR",
    payload: { ...stats, kind: "live-comparables", city },
    source: AQAR_ADAPTER_ID,
  };
}
