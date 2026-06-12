import { ChatOpenAI } from "@langchain/openai";
import type { AgentEnv } from "../env";

/**
 * DeepSeek via its direct OpenAI-compatible HTTPS API (PRD §3.6): the
 * reasoning-heavy half of the model policy. deepseek-chat is the default;
 * deepseek-reasoner is deliberately not, because its separate reasoning
 * channel doesn't fit the strict-JSON draft contract in lib/agent/draft.ts.
 */
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

export function deepseekModelId(env: AgentEnv): string {
  return env.deepseekModel ?? DEFAULT_DEEPSEEK_MODEL;
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
    configuration: { baseURL: DEEPSEEK_BASE_URL },
  });
}
