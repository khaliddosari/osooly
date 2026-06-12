import { round2 } from "@/lib/format";
import {
  readSnapshots,
  usableReading,
  type Freshness,
} from "@/lib/market-snapshot";
import {
  fetchStockMarketData,
  TASI_SYMBOL,
} from "@/src/cards/stock-market/fetcher";
import { summarizeReading, type ReadingSummary, type ToolImpl } from "../types";

/**
 * Stocks tools (PRD §3.6): the stocks sub-agent's read surface. Everything
 * comes from the shared market_snapshot cache and the user's own ledger;
 * the tools never call a provider API (PRD §3.5a rule 1).
 */

export interface StockQuoteResult {
  symbol: string;
  found: boolean;
  quote: (ReadingSummary & { percentChange: number | null }) | null;
}

export const getStockQuote: ToolImpl<{ symbol: string }, StockQuoteResult> = {
  name: "get_stock_quote",
  description:
    "Read the latest cached quote (price, percent change, OHLC) for a stock symbol from the shared market snapshot.",
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Ticker, e.g. 2222 or TASI" },
    },
    required: ["symbol"],
  },
  async run({ db }, input) {
    const symbol = String(input.symbol ?? "").trim();
    const [reading] = symbol ? await readSnapshots(db, "stocks", [symbol]) : [];
    const summary = summarizeReading(reading);
    return {
      symbol,
      found: summary !== null,
      quote: summary && {
        ...summary,
        percentChange: numOrNull(reading?.payload?.percentChange),
      },
    };
  },
};

export interface StockHoldingSummary {
  assetId: string;
  name: string;
  symbol: string | null;
  quantity: number;
  purchasePrice: number | null;
  purchaseCurrency: string;
  costBasis: number | null;
  lastPrice: number | null;
  marketValue: number | null;
  freshness: Freshness | "missing";
}

export interface StockHoldingsResult {
  index: ReadingSummary | null;
  holdings: StockHoldingSummary[];
}

export const listStockHoldings: ToolImpl<
  Record<string, never>,
  StockHoldingsResult
> = {
  name: "list_stock_holdings",
  description:
    "List the signed-in user's stock holdings with quantity, cost basis, and current market value, for allocation-drift checks.",
  inputSchema: { type: "object", properties: {} },
  async run(ctx) {
    const data = await fetchStockMarketData(ctx);
    return {
      index: summarizeReading(data.index),
      holdings: data.holdings.map((holding) => {
        const priced = usableReading(holding.snapshot);
        return {
          assetId: holding.assetId,
          name: holding.name,
          symbol: holding.symbol,
          quantity: holding.quantity,
          purchasePrice: holding.purchasePrice,
          purchaseCurrency: holding.purchaseCurrency,
          costBasis:
            holding.purchasePrice !== null
              ? round2(holding.purchasePrice * holding.quantity)
              : null,
          lastPrice: priced?.price ?? null,
          marketValue: priced
            ? round2(priced.price * holding.quantity)
            : null,
          freshness: holding.snapshot?.freshness ?? "missing",
        };
      }),
    };
  },
};

export { TASI_SYMBOL };

function numOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const stockToolImpls = [getStockQuote, listStockHoldings] as const;
