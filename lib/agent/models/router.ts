import type { RecommendationAction } from "@/lib/recommendations";
import type { AgentEnv } from "../env";
import { deepseekModelId, makeDeepSeekChat } from "./deepseek";
import { xaiModelId } from "./xai";

/**
 * Policy-based model selection (PRD §3.6): DeepSeek V4 Flash does all the
 * heavy lifting (classification, summarization, reasoning). Cheap-first
 * survives as a token policy: every asset is triaged with a short call, and
 * only uncertain or action-suggesting triages escalate to the full draft
 * call (shouldEscalate). Live news search is a separate role: xAI Grok does
 * the X.com search exclusively, with DeepSeek web search (the same
 * OpenRouter key) as the fallback. The policy is pure so it is testable
 * without keys.
 */

export type AgentTask = "classification" | "summarization" | "reasoning";

export interface ModelChoice {
  provider: "deepseek" | "xai";
  model: string;
}

export function pickModel(task: AgentTask, env: AgentEnv = {}): ModelChoice {
  void task; // every task routes to the same provider under the V4 Flash policy
  return { provider: "deepseek", model: deepseekModelId(env) };
}

/**
 * The live market-news searcher (PRD §3.6): xAI Grok (X.com search) when
 * its key is configured, DeepSeek web search otherwise, null when no key is
 * available (the run then proceeds on the RSS news corpus alone).
 */
export function pickNewsSearcher(env: AgentEnv = {}): ModelChoice | null {
  if (env.xaiApiKey) return { provider: "xai", model: xaiModelId(env) };
  if (env.deepseekApiKey) {
    return { provider: "deepseek", model: deepseekModelId(env) };
  }
  return null;
}

/**
 * The `model` column stamp for a Recommendation row (PRD §3.6). OpenRouter
 * slugs already lead with the provider (deepseek/deepseek-v4-flash), so the
 * prefix is only added when missing.
 */
export function modelStamp(choice: ModelChoice): string {
  return choice.model.startsWith(`${choice.provider}/`)
    ? choice.model
    : `${choice.provider}/${choice.model}`;
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

/**
 * Token accounting from a model reply (PRD §3.9 cost controls). LangChain
 * populates `usage_metadata` on the AIMessage from the provider's usage block;
 * it is optional here so test stubs that return only `content` still satisfy
 * ChatLike (and simply contribute zero to the run's token tally).
 */
export interface UsageMetadata {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

export interface ChatReply {
  content: unknown;
  usage_metadata?: UsageMetadata | null;
}

/** Total tokens a reply reports, or 0 when the provider omitted usage. */
export function replyTokens(reply: ChatReply): number {
  const total = reply.usage_metadata?.total_tokens;
  return typeof total === "number" && Number.isFinite(total) && total > 0
    ? total
    : 0;
}

/** The minimal chat surface the agent layer needs; ChatOpenAI satisfies it. */
export interface ChatLike {
  invoke(messages: ["system" | "human", string][]): Promise<ChatReply>;
}

/** A chat model paired with the choice that built it, for `model` stamps. */
export interface BoundModel {
  choice: ModelChoice;
  chat: ChatLike;
}

export function buildBoundModel(task: AgentTask, env: AgentEnv): BoundModel {
  return { choice: pickModel(task, env), chat: makeDeepSeekChat(env) };
}
