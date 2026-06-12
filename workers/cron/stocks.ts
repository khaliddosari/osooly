import { upsertSnapshots } from "../../lib/market-snapshot";
import {
  fetchStockQuotes,
  MAX_SYMBOLS_PER_RUN,
} from "../../src/adapters/stocks/twelveData";
import type { CronEnv } from "./config";

/**
 * Stocks refresh (every minute during Tadawul hours). One batched Twelve
 * Data call for every symbol the *platform* tracks: the TASI index plus
 * every distinct symbol users hold — shared cache, never per-user fetches
 * (PRD §3.5a rule 1).
 */
const DEFAULT_SYMBOLS = ["TASI"];

export async function refreshStocks(env: CronEnv): Promise<void> {
  const symbols = await trackedSymbols(env);
  const writes = await fetchStockQuotes({
    symbols,
    apiKey: env.TWELVE_DATA_API_KEY ?? "",
  });
  await upsertSnapshots(env.DB, writes);
  console.log(
    JSON.stringify({
      event: "stocks.refresh",
      requested: symbols.length,
      written: writes.length,
    })
  );
}

async function trackedSymbols(env: CronEnv): Promise<string[]> {
  const fromEnv = (env.STOCK_SYMBOLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { results } = await env.DB.prepare(
    `SELECT DISTINCT symbol FROM assets
     WHERE asset_class = 'stocks' AND symbol IS NOT NULL`
  ).all<{ symbol: string }>();

  const symbols = [
    ...new Set([
      ...DEFAULT_SYMBOLS,
      ...fromEnv,
      ...results.map((r) => r.symbol),
    ]),
  ];
  // The free tier allows 8 credits/min and a batch costs 1/symbol; beyond
  // the cap we'd need symbol rotation across runs (revisit before S5 if
  // real portfolios get broader).
  return symbols.slice(0, MAX_SYMBOLS_PER_RUN);
}
