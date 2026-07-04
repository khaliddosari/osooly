import { getCloudflareContext } from "@opennextjs/cloudflare";
import { openValue, sealValue } from "./crypto/pii";

/**
 * The D1 database, for route handlers and server components. In `next dev`
 * the binding comes from initOpenNextCloudflareForDev() (next.config.ts),
 * backed by wrangler's local D1; deployed, it's the real binding.
 */
export async function getDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

/* ── Column-level PII encryption (S10) ───────────────────────────────────────
 *
 * PRD §3.9: identifying fields are encrypted at rest in D1 at the column
 * level. These two functions are the single seam where that happens — every
 * write/read of a [PII]-marked column (see migrations/0001_init.sql) goes
 * through them. The bodies are real AES-256-GCM as of S10 (lib/crypto/pii.ts);
 * they stay synchronous so call sites never changed. null/undefined pass
 * straight through, and lib/crypto handles the key-free (dev) and legacy
 * plaintext cases so turning the key on is a no-downtime change.
 */

export function sealPII<T extends string | null | undefined>(plaintext: T): T {
  return (plaintext == null ? plaintext : sealValue(plaintext)) as T;
}

export function openPII<T extends string | null | undefined>(sealed: T): T {
  return (sealed == null ? sealed : openValue(sealed)) as T;
}
