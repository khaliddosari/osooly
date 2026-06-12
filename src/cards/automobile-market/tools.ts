import type { AgentTool } from "@/lib/cards/types";
import {
  estimateVehicleDepreciation,
  getVehicleMarketPrice,
} from "@/src/agent/tools/autos";
import { toAgentTool } from "@/src/agent/tools/types";

/**
 * Tools the autos sub-agent registers when this card is mounted (PRD §3.6).
 * Real since S6: implementations live in src/agent/tools/autos/ and read
 * the nightly Syarah + Haraj medians through the card server context.
 */
export const automobileMarketTools: AgentTool[] = [
  toAgentTool(getVehicleMarketPrice),
  toAgentTool(estimateVehicleDepreciation),
];
