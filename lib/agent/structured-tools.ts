import { tool, type DynamicStructuredTool } from "@langchain/core/tools";
import type { CardServerContext } from "@/lib/cards/server-context";
import type { ToolImpl } from "@/src/agent/tools/types";

/**
 * The seam AGENTS.md promises: every agent tool is a LangChain
 * StructuredTool at the agent layer. ToolImpls stay LangChain-free (cards
 * import them, and card modules are client-bundled); the sub-agents bind
 * them here, fixing the run's {db, userId} so the tool surface a model or
 * a graph node sees is already user-scoped.
 */
export function bindStructuredTool<I, O>(
  impl: ToolImpl<I, O>,
  ctx: CardServerContext
): DynamicStructuredTool {
  return tool(async (input: unknown) => impl.run(ctx, input as I), {
    name: impl.name,
    description: impl.description,
    schema: impl.inputSchema,
  }) as DynamicStructuredTool;
}
