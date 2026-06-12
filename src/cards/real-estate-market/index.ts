import { cardServerContext } from "@/lib/cards/server-context";
import type { CardDefinition } from "@/lib/cards/types";
import { RealEstateMarketCard } from "./component";
import { fetchRealEstateMarketData } from "./fetcher";
import { realEstateMarketTools } from "./tools";

/**
 * Real Estate Market card (PRD §3.5 catalogue): REGA/MoJ transaction index
 * (official, primary) + Aqar live comparables via the shared market_snapshot
 * cache; the agent estimates current values and flags neighborhood-level
 * shifts (S6).
 */
export const realEstateMarketCard: CardDefinition = {
  id: "real-estate-market",
  title: "Real Estate Market",
  icon: "apartment",
  category: "market",
  defaultSize: { w: 2, h: 2 },
  minSize: { w: 2, h: 1 },
  Component: RealEstateMarketCard,
  fetcher: async () => fetchRealEstateMarketData(await cardServerContext()),
  agentTools: realEstateMarketTools,
};
