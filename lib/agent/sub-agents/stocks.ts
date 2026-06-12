import {
  getStockQuote,
  listStockHoldings,
  TASI_SYMBOL,
  type StockHoldingsResult,
  type StockQuoteResult,
} from "@/src/agent/tools/stocks";
import { bindStructuredTool } from "../structured-tools";
import type { SubAgent } from "./types";

/**
 * Stocks sub-agent (PRD §3.6): one evidence bundle per holding, built from
 * the card's two tools; the TASI index reading rides along as the market
 * backdrop for every holding.
 */
export const stocksSubAgent: SubAgent = {
  assetClass: "stocks",
  cardId: "stock-market",
  async gather(ctx) {
    const holdingsTool = bindStructuredTool(listStockHoldings, ctx);
    const quoteTool = bindStructuredTool(getStockQuote, ctx);

    const portfolio = (await holdingsTool.invoke({})) as StockHoldingsResult;

    return Promise.all(
      portfolio.holdings.map(async (holding) => {
        const quote = holding.symbol
          ? ((await quoteTool.invoke({
              symbol: holding.symbol,
            })) as StockQuoteResult)
          : null;
        return {
          assetId: holding.assetId,
          assetName: holding.name,
          evidence: {
            holding,
            quote: quote?.quote ?? null,
            [`index_${TASI_SYMBOL}`]: portfolio.index,
          },
        };
      })
    );
  },
};
