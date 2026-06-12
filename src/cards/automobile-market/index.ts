import { cardServerContext } from "@/lib/cards/server-context";
import type { CardDefinition } from "@/lib/cards/types";
import { AutomobileMarketCard } from "./component";
import { fetchAutoMarketData } from "./fetcher";
import { automobileMarketTools } from "./tools";

/**
 * Automobile Market card (PRD §3.5 catalogue): nightly Syarah + Haraj
 * medians via the shared market_snapshot cache; the agent tracks
 * depreciation and suggests sell/hold windows (S6).
 */
export const automobileMarketCard: CardDefinition = {
  id: "automobile-market",
  title: "Automobile Market",
  icon: "directions_car",
  category: "market",
  defaultSize: { w: 2, h: 2 },
  minSize: { w: 2, h: 1 },
  Component: AutomobileMarketCard,
  fetcher: async () => fetchAutoMarketData(await cardServerContext()),
  agentTools: automobileMarketTools,
};
