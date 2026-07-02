import type { AgentTool } from "@/lib/cards/types";
import {
  estimateVehicleDepreciation,
  getVehicleMarketPrice,
} from "@/src/agent/tools/autos";
import { runAutoml } from "@/src/agent/tools/automl";
import { toAgentTool } from "@/src/agent/tools/types";

/**
 * Tools the autos sub-agent registers when this card is mounted (PRD §3.6).
 * Real since S6: implementations live in src/agent/tools/autos/ and read
 * the nightly Syarah + Haraj medians through the card server context.
 * run_automl (S8, PRD §3.7) trains a Namtheg model on the ledger.
 */
export const automobileMarketTools: AgentTool[] = [
  toAgentTool(getVehicleMarketPrice),
  toAgentTool(estimateVehicleDepreciation),
  toAgentTool(runAutoml),
];
