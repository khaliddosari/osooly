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

  // S9 subscription (PRD §3.10). The provider checkout / manage-billing URL
  // the /subscription page links to (a Stripe / Moyasar / Tap test-mode
  // payment link in dev). Unset: the page shows the plan but disables the
  // button (lib/billing/provider.ts).
  SUBSCRIPTION_CHECKOUT_URL?: string;

  // S10 hardening (PRD §3.9). 32-byte AES-256-GCM key (64 hex chars or base64)
  // for column-level PII encryption (lib/crypto/pii.ts). Set in prod with
  // `wrangler secret put PII_ENCRYPTION_KEY`; unset in dev leaves the seam a
  // pass-through. Read from process.env, so it is intentionally not consumed
  // via the binding object.
  PII_ENCRYPTION_KEY?: string;
}
