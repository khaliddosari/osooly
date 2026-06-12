/**
 * Shared cron-worker config. Lives outside index.ts because workerd treats
 * every named export of the *entry* module as a handler — exporting these
 * strings there crashes the runtime at startup.
 */

export interface CronEnv {
  DB: D1Database;
  TWELVE_DATA_API_KEY?: string;
  /** Surfaced in the scraper User-Agent: `Osooly/1.0 (+<contact>)`. */
  SCRAPER_CONTACT?: string;
  /** Comma-separated extra stock symbols to track platform-wide. */
  STOCK_SYMBOLS?: string;
  /** Override for the REGA open-data dataset URL. */
  REGA_INDEX_URL?: string;
}

/** Must match workers/cron/wrangler.toml [triggers] byte-for-byte. */
export const CRON_STOCKS = "* 7-11 * * 0-4";
export const CRON_GOLD = "0 22 * * *";
export const CRON_AUTOS = "30 22 * * *";
export const CRON_REAL_ESTATE = "0 23 * * *";
