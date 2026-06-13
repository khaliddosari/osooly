/**
 * Agent-layer configuration, decoupled from the Cloudflare context so the
 * orchestrator runs identically from a route handler, a Worker, or a test.
 * Keys live in .dev.vars locally and `wrangler secret put` in production.
 *
 * Only DEEPSEEK_API_KEY is a hard requirement (PRD §3.6): the OpenRouter key
 * powers every triage and draft call plus the web-search fallback for live
 * news. XAI_API_KEY enables the primary X.com news search and is optional;
 * without it the searcher degrades to DeepSeek web search, and without any
 * search the run proceeds on the RSS news corpus alone.
 */

export interface AgentEnv {
  deepseekApiKey?: string;
  xaiApiKey?: string;
  /** Model overrides; defaults live in lib/agent/models/. */
  deepseekModel?: string;
  xaiModel?: string;
  /**
   * Base URL overrides, for routing through Cloudflare AI Gateway (PRD
   * §3.8). Defaults (direct provider URLs) live in lib/agent/models/.
   */
  deepseekBaseUrl?: string;
  xaiBaseUrl?: string;
}

export interface AgentEnvBindings {
  DEEPSEEK_API_KEY?: string;
  XAI_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  XAI_MODEL?: string;
  DEEPSEEK_BASE_URL?: string;
  XAI_BASE_URL?: string;
}

export function agentEnvFromBindings(bindings: AgentEnvBindings): AgentEnv {
  return {
    deepseekApiKey: bindings.DEEPSEEK_API_KEY || undefined,
    xaiApiKey: bindings.XAI_API_KEY || undefined,
    deepseekModel: bindings.DEEPSEEK_MODEL || undefined,
    xaiModel: bindings.XAI_MODEL || undefined,
    deepseekBaseUrl: bindings.DEEPSEEK_BASE_URL || undefined,
    xaiBaseUrl: bindings.XAI_BASE_URL || undefined,
  };
}

/** Secrets still missing for a live run; empty means good to go. */
export function missingProviderKeys(env: AgentEnv): string[] {
  return env.deepseekApiKey ? [] : ["DEEPSEEK_API_KEY"];
}
