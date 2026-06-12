import type { RecommendationAction } from "@/lib/recommendations";
import type { AgentEnv } from "../env";
import { deepseekModelId, makeDeepSeekChat } from "./deepseek";
import { groqModelId, makeGroqChat } from "./groq";

/**
 * Policy-based model selection (PRD §3.6): Groq for fast classification and
 * summarization, DeepSeek for reasoning-heavy recommendation drafts.
 * Cheap-first: every asset is triaged on the classification model, and only
 * uncertain or action-suggesting triages escalate to the reasoning model
 * (shouldEscalate). The policy is pure so it is testable without keys.
 */

export type AgentTask = "classification" | "summarization" | "reasoning";

export interface ModelChoice {
  provider: "groq" | "deepseek";
  model: string;
}

export function pickModel(task: AgentTask, env: AgentEnv = {}): ModelChoice {
  if (task === "reasoning") {
    return { provider: "deepseek", model: deepseekModelId(env) };
  }
  return { provider: "groq", model: groqModelId(env) };
}

/** The `model` column stamp for a Recommendation row (PRD §3.6). */
export function modelStamp(choice: ModelChoice): string {
  return `${choice.provider}/${choice.model}`;
}

/**
 * Below this triage confidence the cheap path isn't trusted with the final
 * word. Buy/sell triages always escalate: anything that could move the
 * user's money gets the reasoning model regardless of stated confidence.
 */
export const ESCALATE_BELOW = 0.6;

export function shouldEscalate(triage: {
  action: RecommendationAction;
  confidence: number;
}): boolean {
  return (
    triage.confidence < ESCALATE_BELOW ||
    triage.action === "buy" ||
    triage.action === "sell"
  );
}

/** The minimal chat surface the agent layer needs; ChatOpenAI satisfies it. */
export interface ChatLike {
  invoke(messages: ["system" | "human", string][]): Promise<{ content: unknown }>;
}

/** A chat model paired with the choice that built it, for `model` stamps. */
export interface BoundModel {
  choice: ModelChoice;
  chat: ChatLike;
}

export function buildBoundModel(task: AgentTask, env: AgentEnv): BoundModel {
  const choice = pickModel(task, env);
  const chat =
    choice.provider === "deepseek" ? makeDeepSeekChat(env) : makeGroqChat(env);
  return { choice, chat };
}
