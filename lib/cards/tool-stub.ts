import type { AgentTool } from "./types";

/**
 * S5 ships every card's agentTools as *contract stubs*: name, description,
 * and input schema are real (so the S6 supervisor can plan against them),
 * but invoke() refuses loudly. Nothing may silently fabricate market
 * reasoning before the agentic layer lands.
 */
export function stubTool(tool: Omit<AgentTool, "invoke">): AgentTool {
  return {
    ...tool,
    invoke: async () => {
      throw new Error(
        `Agent tool "${tool.name}" is an S5 contract stub; the implementation lands with the agentic layer (S6).`
      );
    },
  };
}
