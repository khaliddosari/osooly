import { stubTool } from "@/lib/cards/tool-stub";
import type { AgentTool } from "@/lib/cards/types";

/**
 * Tools the real-estate sub-agent registers when this card is mounted
 * (PRD §3.6). Contract stubs until S6; real implementations land under
 * src/agent/tools/real-estate/ per AGENTS.md working conventions. The
 * AutoML-backed valuation flow (run_automl, PRD §3.7) arrives with S8.
 */
export const realEstateMarketTools: AgentTool[] = [
  stubTool({
    name: "get_city_price_index",
    description:
      "Read the latest cached REGA transaction index and Aqar asking-price median for a city from the shared market snapshot.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, e.g. Riyadh" },
      },
      required: ["city"],
    },
  }),
  stubTool({
    name: "estimate_property_value",
    description:
      "Estimate a saved property's current value from the city's REGA index trend and live comparables, flagging neighborhood-level shifts.",
    inputSchema: {
      type: "object",
      properties: {
        assetId: { type: "string", description: "assets.id of the property" },
      },
      required: ["assetId"],
    },
  }),
];
