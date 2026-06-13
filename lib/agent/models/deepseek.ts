import { ChatOpenAI } from "@langchain/openai";
import type { AgentEnv } from "../env";
import type { FetchLike } from "./xai";

/**
 * DeepSeek V4 Flash via OpenRouter (PRD §3.6): every triage, summarization,
 * and reasoning call runs here, plus the web-search fallback for live news
 * (OpenRouter's `openrouter:web_search` server tool; the primary X.com
 * search lives on xAI in models/xai.ts). Set DEEPSEEK_MODEL in .dev.vars to
 * override the model id; check openrouter.ai/models for the exact slug.
 * DEEPSEEK_API_KEY holds your OpenRouter API key (BYOK configured there).
 */
export const DEEPSEEK_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek/deepseek-v4-flash";

export function deepseekModelId(env: AgentEnv): string {
  return env.deepseekModel ?? DEFAULT_DEEPSEEK_MODEL;
}

/**
 * Set DEEPSEEK_BASE_URL to the Cloudflare AI Gateway OpenRouter endpoint
 * (https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/openrouter/v1)
 * to get caching, spend analytics, and rate limiting (PRD §3.8); the
 * default goes to OpenRouter directly.
 */
export function deepseekBaseUrl(env: AgentEnv): string {
  return env.deepseekBaseUrl ?? DEEPSEEK_BASE_URL;
}

export function makeDeepSeekChat(env: AgentEnv): ChatOpenAI {
  if (!env.deepseekApiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }
  return new ChatOpenAI({
    model: deepseekModelId(env),
    apiKey: env.deepseekApiKey,
    temperature: 0.2,
    maxTokens: 512,
    configuration: { baseURL: deepseekBaseUrl(env) },
  });
}

/**
 * The assistant text of a chat-completions reply; tolerant of malformed
 * payloads (returns "" instead of throwing, callers treat that as a miss).
 */
export function chatCompletionText(payload: unknown): string {
  const choices = (payload as { choices?: unknown })?.choices;
  if (!Array.isArray(choices)) return "";
  const content = (choices[0] as { message?: { content?: unknown } })?.message
    ?.content;
  return typeof content === "string" ? content : "";
}

/**
 * One search-grounded answer for the live-news fallback. A plain fetch
 * rather than ChatOpenAI because `openrouter:web_search` is an
 * OpenRouter-side server tool, not a client tool LangChain would try to
 * execute. Throws on any non-2xx or missing key.
 *
 * The cf-aig-cache-ttl header makes Cloudflare AI Gateway cache the answer
 * for 30 minutes when DEEPSEEK_BASE_URL points at the gateway; the search
 * prompt is deterministic per asset class, so every user shares one search
 * per window (PRD §3.5a rule 1). OpenRouter ignores the header when called
 * directly.
 */
export const NEWS_SEARCH_CACHE_TTL_SECONDS = 1800;

export async function deepseekWebSearch(
  prompt: string,
  env: AgentEnv,
  fetchImpl: FetchLike = fetch
): Promise<string> {
  if (!env.deepseekApiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }
  const response = await fetchImpl(`${deepseekBaseUrl(env)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.deepseekApiKey}`,
      "cf-aig-cache-ttl": String(NEWS_SEARCH_CACHE_TTL_SECONDS),
    },
    body: JSON.stringify({
      model: deepseekModelId(env),
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "openrouter:web_search" }],
      temperature: 0.2,
      max_tokens: 512,
    }),
  });
  if (!response.ok) {
    throw new Error(`DeepSeek web search failed with status ${response.status}`);
  }
  return chatCompletionText(await response.json());
}
