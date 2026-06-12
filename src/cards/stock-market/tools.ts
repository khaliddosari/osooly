import { stubTool } from "@/lib/cards/tool-stub";
import type { AgentTool } from "@/lib/cards/types";

/**
 * Tools the stocks sub-agent registers when this card is mounted (PRD §3.6).
 * Contract stubs until S6; real implementations land under
 * src/agent/tools/stocks/ per AGENTS.md working conventions.
 */
export const stockMarketTools: AgentTool[] = [
  stubTool({
    name: "get_stock_quote",
    description:
      "Read the latest cached quote (price, percent change, OHLC) for a stock symbol from the shared market snapshot.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Ticker, e.g. 2222 or TASI" },
      },
      required: ["symbol"],
    },
  }),
  stubTool({
    name: "list_stock_holdings",
    description:
      "List the signed-in user's stock holdings with quantity, cost basis, and current market value, for allocation-drift checks.",
    inputSchema: { type: "object", properties: {} },
  }),
];
