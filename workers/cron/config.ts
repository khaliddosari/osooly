/**
 * Shared cron-worker config. Lives outside index.ts because workerd treats
 * every named export of the *entry* module as a handler — exporting these
 * strings there crashes the runtime at startup.
 */

export interface CronEnv {
  DB: D1Database;
  /**
   * RAG bindings for the nightly news refresh (PRD §3.6). Optional: local
   * dev has no Vectorize simulator, so the job no-ops without them; the
   * production bindings are enabled in wrangler.toml at deploy (S10).
   */
  AI?: Ai;
  VECTORIZE?: VectorizeIndex;
  /** Comma-separated `assetClass=url` RSS overrides (lib/rag/embed-news). */
  NEWS_FEEDS?: string;
  TWELVE_DATA_API_KEY?: string;
  /** Surfaced in the scraper User-Agent: `Osooly/1.0 (+<contact>)`. */
  SCRAPER_CONTACT?: string;
  /** Comma-separated extra stock symbols to track platform-wide. */
  STOCK_SYMBOLS?: string;
  /**
   * Optional exchangerate.host access key; without it the USD→SAR rate
   * comes from the keyless open.er-api.com feed (PRD §3.10).
   */
  EXCHANGERATE_ACCESS_KEY?: string;
  /** Override for the REGA open-data dataset URL. */
  REGA_INDEX_URL?: string;
}

/** Must match workers/cron/wrangler.toml [triggers] byte-for-byte. */
export const CRON_STOCKS = "* 7-11 * * 0-4";
export const CRON_GOLD = "0 22 * * *";
export const CRON_AUTOS = "30 22 * * *";
export const CRON_REAL_ESTATE = "0 23 * * *";
export const CRON_NEWS = "30 23 * * *";
