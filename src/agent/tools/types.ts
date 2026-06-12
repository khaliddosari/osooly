import {
  cardServerContext,
  type CardServerContext,
} from "@/lib/cards/server-context";
import type { AgentTool } from "@/lib/cards/types";
import type { Freshness, SnapshotReading } from "@/lib/market-snapshot";

/**
 * Agent-tool implementations (AGENTS.md working conventions): one folder per
 * asset class under src/agent/tools/, real since S6. A ToolImpl carries the
 * same name/description/inputSchema contract the S5 stubs pinned, plus a
 * run() that takes an explicit CardServerContext so the orchestrator can
 * bind tools to a run's {db, userId} without a browser session.
 *
 * Two consumers, two wrappers:
 *  - cards list the session-bound AgentTool (toAgentTool) in `agentTools`;
 *  - the sub-agents bind ToolImpls into LangChain StructuredTools via
 *    lib/agent/structured-tools.ts (kept out of this folder so card modules
 *    never pull LangChain into the client bundle).
 */
export interface ToolImpl<I = Record<string, never>, O = unknown> {
  name: string;
  description: string;
  /** JSON schema for the tool input (the S6 formalisation of AgentTool). */
  inputSchema: Record<string, unknown>;
  run: (ctx: CardServerContext, input: I) => Promise<O>;
}

/** The card-facing wrapper: resolves D1 + session through the S3 seam. */
export function toAgentTool<I, O>(impl: ToolImpl<I, O>): AgentTool {
  return {
    name: impl.name,
    description: impl.description,
    inputSchema: impl.inputSchema,
    invoke: async (input) => impl.run(await cardServerContext(), input as I),
  };
}

/**
 * Compact, LLM-facing view of a snapshot reading: the price plus exactly
 * the staleness signal the agent must treat as low-confidence input
 * (PRD §3.5a rule 2). Payload extras are merged in by callers that need
 * them (percent change, listing counts, FX components).
 */
export interface ReadingSummary {
  price: number | null;
  currency: string;
  freshness: Freshness;
  staleLabel: string | null;
  fetchedAt: string;
  source: string;
}

export function summarizeReading(
  reading: SnapshotReading | null | undefined
): ReadingSummary | null {
  if (!reading) return null;
  return {
    price: reading.price,
    currency: reading.currency,
    freshness: reading.freshness,
    staleLabel: reading.staleLabel,
    fetchedAt: reading.fetchedAt,
    source: reading.source,
  };
}
