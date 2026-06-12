import { cardServerContext } from "@/lib/cards/server-context";
import type { CardDefinition } from "@/lib/cards/types";
import { JewelryMarketCard } from "./component";
import { fetchJewelryMarketData } from "./fetcher";
import { jewelryMarketTools } from "./tools";

/**
 * Jewelry Market card (PRD §3.5 catalogue): gold-api.com spot × USD→SAR via
 * the shared market_snapshot cache; the agent re-prices the user's
 * gram-weighted inventory daily (S6).
 */
export const jewelryMarketCard: CardDefinition = {
  id: "jewelry-market",
  title: "Jewelry Market",
  icon: "diamond",
  category: "market",
  defaultSize: { w: 2, h: 2 },
  minSize: { w: 2, h: 1 },
  Component: JewelryMarketCard,
  fetcher: async () => fetchJewelryMarketData(await cardServerContext()),
  agentTools: jewelryMarketTools,
};
