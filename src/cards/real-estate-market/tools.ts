import type { AgentTool } from "@/lib/cards/types";
import { runAutoml } from "@/src/agent/tools/automl";
import {
  estimatePropertyValue,
  getCityPriceIndex,
} from "@/src/agent/tools/real-estate";
import { toAgentTool } from "@/src/agent/tools/types";

/**
 * Tools the real-estate sub-agent registers when this card is mounted
 * (PRD §3.6). Real since S6: implementations live in
 * src/agent/tools/real-estate/ and read the REGA index + Aqar comparables
 * through the card server context. run_automl (S8, PRD §3.7) trains a
 * Namtheg projection on the user's own transaction ledger.
 */
export const realEstateMarketTools: AgentTool[] = [
  toAgentTool(getCityPriceIndex),
  toAgentTool(estimatePropertyValue),
  toAgentTool(runAutoml),
];
