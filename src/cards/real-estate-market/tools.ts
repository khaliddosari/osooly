import type { AgentTool } from "@/lib/cards/types";
import {
  estimatePropertyValue,
  getCityPriceIndex,
} from "@/src/agent/tools/real-estate";
import { toAgentTool } from "@/src/agent/tools/types";

/**
 * Tools the real-estate sub-agent registers when this card is mounted
 * (PRD §3.6). Real since S6: implementations live in
 * src/agent/tools/real-estate/ and read the REGA index + Aqar comparables
 * through the card server context. The AutoML-backed valuation flow
 * (run_automl, PRD §3.7) arrives with S8.
 */
export const realEstateMarketTools: AgentTool[] = [
  toAgentTool(getCityPriceIndex),
  toAgentTool(estimatePropertyValue),
];
