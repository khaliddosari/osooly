import { stubTool } from "@/lib/cards/tool-stub";
import type { AgentTool } from "@/lib/cards/types";

/**
 * Tools the autos sub-agent registers when this card is mounted (PRD §3.6).
 * Contract stubs until S6; real implementations land under
 * src/agent/tools/autos/ per AGENTS.md working conventions.
 */
export const automobileMarketTools: AgentTool[] = [
  stubTool({
    name: "get_vehicle_market_price",
    description:
      "Read the latest cached Syarah (dealer) and Haraj (private-seller) listing medians for a make/model from the shared market snapshot.",
    inputSchema: {
      type: "object",
      properties: {
        make: { type: "string", description: "Manufacturer, e.g. Toyota" },
        model: { type: "string", description: "Model, e.g. Land Cruiser" },
      },
      required: ["make", "model"],
    },
  }),
  stubTool({
    name: "estimate_vehicle_depreciation",
    description:
      "Compare a saved vehicle's purchase price to its current market estimate and report the depreciation trend, for sell/hold window suggestions.",
    inputSchema: {
      type: "object",
      properties: {
        assetId: { type: "string", description: "assets.id of the vehicle" },
      },
      required: ["assetId"],
    },
  }),
];
