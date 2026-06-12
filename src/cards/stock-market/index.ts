import { cardServerContext } from "@/lib/cards/server-context";
import type { CardDefinition } from "@/lib/cards/types";
import { StockMarketCard } from "./component";
import { fetchStockMarketData } from "./fetcher";
import { stockMarketTools } from "./tools";

/**
 * Stock Market card (PRD §3.5 catalogue): Twelve Data quotes read from the
 * shared market_snapshot cache; the agent watches the user's holdings and
 * flags drift vs. target allocation (S6).
 */
export const stockMarketCard: CardDefinition = {
  id: "stock-market",
  title: "Stock Market",
  icon: "insights",
  category: "market",
  defaultSize: { w: 2, h: 2 },
  minSize: { w: 2, h: 1 },
  Component: StockMarketCard,
  fetcher: async () => fetchStockMarketData(await cardServerContext()),
  agentTools: stockMarketTools,
};
