/**
 * Agent-layer configuration, decoupled from the Cloudflare context so the
 * orchestrator runs identically from a route handler, a Worker, or a test.
 * Keys live in .dev.vars locally and `wrangler secret put` in production.
 */

export interface AgentEnv {
  deepseekApiKey?: string;
  groqApiKey?: string;
  /** Model overrides; defaults live in lib/agent/models/. */
  deepseekModel?: string;
  groqModel?: string;
}

export interface AgentEnvBindings {
  DEEPSEEK_API_KEY?: string;
  GROQ_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  GROQ_MODEL?: string;
}

export function agentEnvFromBindings(bindings: AgentEnvBindings): AgentEnv {
  return {
    deepseekApiKey: bindings.DEEPSEEK_API_KEY || undefined,
    groqApiKey: bindings.GROQ_API_KEY || undefined,
    deepseekModel: bindings.DEEPSEEK_MODEL || undefined,
    groqModel: bindings.GROQ_MODEL || undefined,
  };
}

/** Secrets still missing for a live run; empty means good to go. */
export function missingProviderKeys(env: AgentEnv): string[] {
  const missing: string[] = [];
  if (!env.deepseekApiKey) missing.push("DEEPSEEK_API_KEY");
  if (!env.groqApiKey) missing.push("GROQ_API_KEY");
  return missing;
}
