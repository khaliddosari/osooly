import type { PoliteFetcher } from "../polite-fetch";
import { extractPrices, slugify, summarize } from "../scrape-stats";
import { AdapterError, type SnapshotWrite } from "../types";

/**
 * Haraj listings (PRD §3.5) — the second autos source. Haraj prices skew
 * private-seller vs Syarah's dealer stock, so the cron keeps both rows
 * (symbols are suffixed per source) and the card/agent can compare.
 * Same polite-scraping rules and same caveats as syarah.ts.
 */
export const HARAJ_ADAPTER_ID = "haraj";

const PRICE_BAND = { min: 10_000, max: 2_000_000 };

export async function fetchHarajListing(
  polite: PoliteFetcher,
  make: string,
  model: string
): Promise<SnapshotWrite> {
  const query = encodeURIComponent(`${make} ${model}`);
  const res = await polite.fetch(`https://haraj.com.sa/search/${query}`);
  if (!res.ok) {
    throw new AdapterError(HARAJ_ADAPTER_ID, `HTTP ${res.status}`);
  }
  const stats = summarize(extractPrices(await res.text(), PRICE_BAND));
  if (!stats) {
    throw new AdapterError(
      HARAJ_ADAPTER_ID,
      `no listings parsed for ${make} ${model}`
    );
  }
  return {
    assetClass: "autos",
    symbol: `${slugify(make, model)}:haraj`,
    price: stats.median,
    currency: "SAR",
    payload: { ...stats, make, model },
    source: HARAJ_ADAPTER_ID,
  };
}
