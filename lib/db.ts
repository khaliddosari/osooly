import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * The D1 database, for route handlers and server components. In `next dev`
 * the binding comes from initOpenNextCloudflareForDev() (next.config.ts),
 * backed by wrangler's local D1; deployed, it's the real binding.
 */
export async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

/* ── Column-level PII encryption (stubbed until S10) ─────────────────────────
 *
 * PRD §3.9: identifying fields are encrypted at rest in D1 at the column
 * level. These two functions are the single seam where that happens — every
 * write/read of a [PII]-marked column (see migrations/0001_init.sql) must go
 * through them. v1 ships them as pass-throughs; S10 swaps the bodies for real
 * AES-GCM with managed keys without touching any call site.
 */

export function sealPII<T extends string | null | undefined>(plaintext: T): T {
  return plaintext;
}

export function openPII<T extends string | null | undefined>(sealed: T): T {
  return sealed;
}
