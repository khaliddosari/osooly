import { stubTool } from "@/lib/cards/tool-stub";
import type { AgentTool } from "@/lib/cards/types";

/**
 * Tools the jewelry sub-agent registers when this card is mounted
 * (PRD §3.6). Contract stubs until S6; real implementations land under
 * src/agent/tools/jewelry/ per AGENTS.md working conventions.
 */
export const jewelryMarketTools: AgentTool[] = [
  stubTool({
    name: "get_gold_spot",
    description:
      "Read the latest cached SAR/gram fine-gold spot (with its USD/oz and USD-to-SAR components) from the shared market snapshot.",
    inputSchema: { type: "object", properties: {} },
  }),
  stubTool({
    name: "value_jewelry_inventory",
    description:
      "Re-price the signed-in user's gram-weighted jewelry inventory at the current spot, adjusted per piece by karat purity.",
    inputSchema: { type: "object", properties: {} },
  }),
];
