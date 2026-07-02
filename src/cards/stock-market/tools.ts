import type { AgentTool } from "@/lib/cards/types";
import { runAutoml } from "@/src/agent/tools/automl";
import {
  getStockQuote,
  listStockHoldings,
} from "@/src/agent/tools/stocks";
import { toAgentTool } from "@/src/agent/tools/types";

/**
 * Tools the stocks sub-agent registers when this card is mounted (PRD §3.6).
 * Real since S6: implementations live in src/agent/tools/stocks/ and read
 * the shared cache + the user's ledger through the card server context.
 * run_automl (S8, PRD §3.7) trains a Namtheg model on the ledger.
 */
export const stockMarketTools: AgentTool[] = [
  toAgentTool(getStockQuote),
  toAgentTool(listStockHoldings),
  toAgentTool(runAutoml),
];
