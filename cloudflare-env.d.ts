/// <reference types="@cloudflare/workers-types" />

// Bindings + secrets reachable via getCloudflareContext().env. OpenNext types
// `env` against this global interface name. Keep in sync with wrangler.toml
// and .dev.vars.example (or regenerate with `wrangler types --env-interface
// CloudflareEnv cloudflare-env.d.ts`).
interface CloudflareEnv {
  DB: D1Database;
  AUTH_SECRET: string;
  AUTH_GOOGLE_ID: string;
  AUTH_GOOGLE_SECRET: string;

  // S6 agentic layer (PRD §3.6). The model keys gate POST /api/agent/run
  // (503 without them); the RAG bindings are optional everywhere because
  // local dev has no Vectorize simulator (lib/rag/vectorize.ts degrades).
  DEEPSEEK_API_KEY?: string;
  XAI_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  XAI_MODEL?: string;
  AI?: Ai;
  VECTORIZE?: VectorizeIndex;

  // S8 Namtheg sidecar (PRD §3.7). The URL feeds the /api/namtheg proxy
  // (defaults to http://localhost:8000 for dev); the token authenticates
  // the run_automl agent tool's server-to-server calls and must match the
  // sidecar's NAMTHEG_INTERNAL_TOKEN.
  NAMTHEG_SIDECAR_URL?: string;
  NAMTHEG_INTERNAL_TOKEN?: string;
}
