/**
 * Column-level PII encryption (PRD §3.9, S10). This is the real body behind the
 * `sealPII` / `openPII` seam in lib/db.ts: AES-256-GCM (authenticated) via
 * `node:crypto`, which the Workers runtime provides under the `nodejs_compat`
 * flag already set in wrangler.toml. The seam stays synchronous exactly as
 * lib/db.ts promised, so no call site changes when encryption turns on.
 *
 * Key management: the 32-byte key comes from the PII_ENCRYPTION_KEY secret
 * (`wrangler secret put PII_ENCRYPTION_KEY`), read from process.env, which
 * OpenNext populates from the Cloudflare env (and initOpenNextCloudflareForDev
 * populates from .dev.vars in dev). Accepts a 64-char hex or a base64 string
 * that decodes to 32 bytes.
 *
 * Backward / forward compatibility:
 * - Sealed values carry a "v1:" scheme prefix. openValue() returns anything
 *   without that prefix unchanged, so the plaintext rows written while the seam
 *   was a pass-through (S1–S9) keep reading correctly after the key lands.
 * - When no key is configured (local dev without the secret), sealValue() is a
 *   pass-through, so the app runs key-free and existing data is untouched.
 *
 * Scope: this protects the [PII] columns Osooly's own code writes (today
 * `assets.details`; see lib/assets/store.ts). The NextAuth-managed tables are
 * written by @auth/d1-adapter, not through this seam: `users.email` must stay
 * queryable for account lookup, and encrypting the `accounts` OAuth-token
 * columns would require wrapping the adapter (tracked in SECURITY.md).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Scheme/version marker on every sealed value. Bump when the format changes. */
const SCHEME = "v1:";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce length
const TAG_BYTES = 16; // GCM auth tag length
const KEY_BYTES = 32; // AES-256

/** Parse the configured key once. `null` means "no key" → pass-through mode. */
let cachedKey: Buffer | null | undefined;

function loadKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  cachedKey = parseKey(process.env.PII_ENCRYPTION_KEY);
  return cachedKey;
}

/** Test seam: reset the memoised key after changing process.env in a test. */
export function resetKeyCache(): void {
  cachedKey = undefined;
}

function parseKey(raw: string | undefined): Buffer | null {
  const value = raw?.trim();
  if (!value) return null;
  const buf = /^[0-9a-fA-F]{64}$/.test(value)
    ? Buffer.from(value, "hex")
    : safeBase64(value);
  if (!buf || buf.length !== KEY_BYTES) {
    // A misconfigured key must fail loudly rather than silently persisting
    // plaintext that operators believe is encrypted.
    throw new Error(
      `PII_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64); got ${
        buf ? `${buf.length} bytes` : "an unparseable value"
      }.`
    );
  }
  return buf;
}

function safeBase64(value: string): Buffer | null {
  try {
    return Buffer.from(value, "base64");
  } catch {
    return null;
  }
}

/** Encrypt one plaintext string. Returns it unchanged when no key is set. */
export function sealValue(plaintext: string): string {
  const key = loadKey();
  if (!key) return plaintext;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return SCHEME + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * Decrypt a value produced by sealValue(). Anything without the scheme prefix
 * (legacy plaintext, or data written while key-free) is returned unchanged.
 * A prefixed value with no key configured is a misconfiguration and throws,
 * rather than returning ciphertext as if it were plaintext.
 */
export function openValue(sealed: string): string {
  if (!sealed.startsWith(SCHEME)) return sealed;
  const key = loadKey();
  if (!key) {
    throw new Error(
      "Encountered an encrypted value but PII_ENCRYPTION_KEY is not configured."
    );
  }
  const blob = Buffer.from(sealed.slice(SCHEME.length), "base64");
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = blob.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8");
}
