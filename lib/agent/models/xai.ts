import type { AgentEnv } from "../env";

/**
 * xAI Grok via the Responses API (PRD §3.6): the primary live market-news
 * searcher, and exclusively the X.com half; web search lives on DeepSeek
 * through OpenRouter (models/deepseek.ts). The old `search_parameters` Live
 * Search API was retired in January 2026; the current shape declares the
 * server-side `x_search` agent tool on the request, and xAI runs the search
 * before answering. XAI_MODEL overrides the model id without a code change.
 */
export const XAI_BASE_URL = "https://api.x.ai/v1";
export const DEFAULT_XAI_MODEL = "grok-4.3";

export function xaiModelId(env: AgentEnv): string {
  return env.xaiModel ?? DEFAULT_XAI_MODEL;
}

/**
 * XAI_BASE_URL override seam. Cloudflare AI Gateway's grok provider only
 * documents chat completions, not the Responses API this client needs, so
 * the default stays direct; the override exists for when gateway support
 * lands (or for tests).
 */
export function xaiBaseUrl(env: AgentEnv): string {
  return env.xaiBaseUrl ?? XAI_BASE_URL;
}

/**
 * The assistant text of a Responses API reply. Tolerates both the
 * convenience `output_text` field and the raw `output` array of message
 * items, because providers differ on which they include.
 */
export function responsesOutputText(payload: unknown): string {
  const body = payload as {
    output_text?: unknown;
    output?: unknown;
  } | null;
  if (typeof body?.output_text === "string" && body.output_text.trim()) {
    return body.output_text;
  }
  if (!Array.isArray(body?.output)) return "";
  const parts: string[] = [];
  for (const item of body.output) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const text = (part as { text?: unknown })?.text;
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.join("");
}

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** One search-grounded answer from Grok; throws on any non-2xx or no key. */
export async function xaiSearch(
  prompt: string,
  env: AgentEnv,
  fetchImpl: FetchLike = fetch
): Promise<string> {
  if (!env.xaiApiKey) {
    throw new Error("XAI_API_KEY is not configured");
  }
  const response = await fetchImpl(`${xaiBaseUrl(env)}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.xaiApiKey}`,
    },
    body: JSON.stringify({
      model: xaiModelId(env),
      input: [{ role: "user", content: prompt }],
      tools: [{ type: "x_search" }],
    }),
  });
  if (!response.ok) {
    throw new Error(`xAI search failed with status ${response.status}`);
  }
  return responsesOutputText(await response.json());
}
