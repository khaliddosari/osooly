import { AdapterError, type FetchLike, type SnapshotWrite } from "../types";

/**
 * Twelve Data free tier (PRD §3.5): TASI + global indices, 800 credits/day,
 * 8 credits/min. One batched /quote call costs one credit per symbol, so the
 * per-run cap below keeps a 1-minute market-hours cadence inside both caps:
 * 8 symbols × ~300 market-minute runs/day = within budget only for small
 * lists — the shared market_snapshot cache (PRD §3.5a rule 1) is what makes
 * that list user-count-independent.
 */
export const TWELVE_DATA_ADAPTER_ID = "twelve-data";
export const MAX_SYMBOLS_PER_RUN = 8;

const BASE_URL = "https://api.twelvedata.com/quote";

interface TwelveDataQuote {
  symbol?: string;
  close?: string;
  currency?: string;
  percent_change?: string;
  open?: string;
  high?: string;
  low?: string;
  previous_close?: string;
  is_market_open?: boolean;
  status?: string; // "error" on per-symbol failures
  message?: string;
  code?: number;
}

export async function fetchStockQuotes(options: {
  symbols: string[];
  apiKey: string;
  fetchImpl?: FetchLike;
}): Promise<SnapshotWrite[]> {
  const { apiKey, fetchImpl = fetch } = options;
  const symbols = options.symbols.slice(0, MAX_SYMBOLS_PER_RUN);
  if (symbols.length === 0) return [];
  if (!apiKey) {
    throw new AdapterError(TWELVE_DATA_ADAPTER_ID, "missing TWELVE_DATA_API_KEY");
  }

  const url = `${BASE_URL}?symbol=${encodeURIComponent(symbols.join(","))}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new AdapterError(TWELVE_DATA_ADAPTER_ID, `HTTP ${res.status}`);
  }
  return parseQuoteResponse(await res.json(), symbols);
}

/**
 * /quote returns the bare quote object for one symbol, or a map keyed by
 * symbol for a batch. Per-symbol errors come back as {status:"error"} values
 * — those are skipped (their last-known snapshot rows stay put), not thrown.
 */
export function parseQuoteResponse(
  body: unknown,
  requestedSymbols: string[]
): SnapshotWrite[] {
  if (typeof body !== "object" || body === null) {
    throw new AdapterError(TWELVE_DATA_ADAPTER_ID, "non-object response");
  }
  const root = body as Record<string, unknown> & TwelveDataQuote;

  // A top-level error (bad key, rate limit) fails the whole run.
  if (root.status === "error") {
    throw new AdapterError(
      TWELVE_DATA_ADAPTER_ID,
      `${root.code ?? "?"}: ${root.message ?? "unknown error"}`
    );
  }

  const quotes: TwelveDataQuote[] =
    requestedSymbols.length === 1
      ? [root]
      : requestedSymbols.map(
          (s) => (root[s] ?? {}) as TwelveDataQuote
        );

  const writes: SnapshotWrite[] = [];
  for (const [i, quote] of quotes.entries()) {
    if (quote.status === "error" || quote.close === undefined) continue;
    const price = Number(quote.close);
    if (!Number.isFinite(price)) continue;
    writes.push({
      assetClass: "stocks",
      symbol: quote.symbol ?? requestedSymbols[i],
      price,
      currency: quote.currency ?? "USD",
      payload: {
        open: numOrNull(quote.open),
        high: numOrNull(quote.high),
        low: numOrNull(quote.low),
        previousClose: numOrNull(quote.previous_close),
        percentChange: numOrNull(quote.percent_change),
        isMarketOpen: quote.is_market_open ?? null,
      },
      source: TWELVE_DATA_ADAPTER_ID,
    });
  }
  return writes;
}

function numOrNull(value: string | undefined): number | null {
  const n = Number(value);
  return value !== undefined && Number.isFinite(n) ? n : null;
}
