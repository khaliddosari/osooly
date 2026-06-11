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
}
