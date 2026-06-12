import { ChatOpenAI } from "@langchain/openai";
import type { AgentEnv } from "../env";

/**
 * Groq via its OpenAI-compatible HTTPS API (PRD §3.6): the fast, cheap half
 * of the model policy. PRD says "Llama-3.1-70B or similar"; Groq retired
 * llama-3.1-70b-versatile, so the 3.3 successor is the default ("or
 * similar"), overridable via GROQ_MODEL without a code change.
 */
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

export function groqModelId(env: AgentEnv): string {
  return env.groqModel ?? DEFAULT_GROQ_MODEL;
}

export function makeGroqChat(env: AgentEnv): ChatOpenAI {
  if (!env.groqApiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }
  return new ChatOpenAI({
    model: groqModelId(env),
    apiKey: env.groqApiKey,
    temperature: 0.2,
    maxTokens: 384,
    configuration: { baseURL: GROQ_BASE_URL },
  });
}
