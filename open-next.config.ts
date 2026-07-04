import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext Cloudflare adapter config (S10 deploy). Wraps the Next.js build into
 * a Cloudflare Worker (`.open-next/worker.js`) plus a static assets directory
 * (`.open-next/assets`), which wrangler.toml points `main` / `[assets]` at.
 * Defaults are sufficient for v1: no incremental-cache override (the dashboard
 * is per-user and dynamic), so the plain config keeps the deploy simple.
 *
 * Build + deploy from the repo root:
 *   npx opennextjs-cloudflare build
 *   npx wrangler deploy
 */
export default defineCloudflareConfig();
