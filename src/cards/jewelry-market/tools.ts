import type { AgentTool } from "@/lib/cards/types";
import {
  getGoldSpot,
  valueJewelryInventory,
} from "@/src/agent/tools/jewelry";
import { toAgentTool } from "@/src/agent/tools/types";

/**
 * Tools the jewelry sub-agent registers when this card is mounted
 * (PRD §3.6). Real since S6: implementations live in
 * src/agent/tools/jewelry/ and read the shared cache + the user's
 * gram-weighted inventory through the card server context.
 */
export const jewelryMarketTools: AgentTool[] = [
  toAgentTool(getGoldSpot),
  toAgentTool(valueJewelryInventory),
];
