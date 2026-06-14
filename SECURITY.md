# Security

This file tracks the security posture of the Osooly repo and the resolution of
the 2026-06-13 security audit. The binding spec is [`Docs/PRD.md`](Docs/PRD.md);
non-functional security requirements live in PRD §3.9.

## Audit resolution (2026-06-13)

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | PII / OAuth tokens stored in plaintext in D1 | Medium | Deferred to S10 (PRD §3.9) |
| 2 | CSRF on `POST /api/agent/run` | Medium-Low | Fixed |
| 3 | Dependency vulnerabilities (esbuild, postcss) | Low (build/dev) | Mitigated; residual is build-only |
| 4 | No HTTP security headers | Low | Fixed |
| 5 | Prompt injection via scraped/news text | Low | Hardened |
| 6 | Twelve Data API key not URL-encoded | Low | Fixed |

### 1. PII / OAuth tokens at rest (deferred by design)

Real AES-GCM column encryption is deferred to S10 per PRD §3.9. The seam exists
today: every read/write of a `[PII]`-marked column goes through `sealPII` /
`openPII` in [`lib/db.ts`](lib/db.ts), currently pass-throughs. S10 swaps the
bodies (covering the `accounts` OAuth token columns) without touching call
sites. Do not change this without updating PRD §3.9 first.

### 2. CSRF on the agent run endpoint (fixed)

`POST /api/agent/run` now rejects cross-site requests before touching the
session. It trusts `Sec-Fetch-Site` when present (allowing only `same-origin` /
`none`) and falls back to an `Origin` vs `Host` comparison. See
[`app/api/agent/run/route.ts`](app/api/agent/run/route.ts).

### 3. Dependency advisories (residual is build-only)

Everything within our control is on a patched version: our direct `postcss` is
pinned to `^8.5.15` (XSS patch), and `wrangler` / `@opennextjs/cloudflare` are
already at their latest releases. `npm audit` still reports two transitive
advisories that have **no non-breaking fix** and are **build/dev-time only**,
never reaching the deployed Workers runtime:

- **esbuild `0.27.3`** (GHSA-gv7w-rqvm-qjhr dev-server RCE, GHSA-g7r4-m6w7-qqqr
  Windows dev-server file read) is pinned transitively by `wrangler`. The only
  `npm audit fix --force` path downgrades `wrangler` to `3.6.0`, a destructive
  major rollback. It runs only during local build/dev, not in production.
- **postcss `8.4.31`** is bundled inside `next@15.5.19` (current). It is internal
  to Next's compiler and clears when Next bumps it.

Do not run `npm audit fix --force` (it would install `wrangler@3.6.0` /
`next@9.3.3`). Re-check these when bumping `wrangler` or `next`.

### 4. HTTP security headers (fixed)

[`next.config.ts`](next.config.ts) sets a `Content-Security-Policy` scoped to
the fonts/CDN the app actually loads, plus `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, and HSTS.

### 5. Prompt injection (hardened)

Retrieved RSS/news text and user asset names are treated as untrusted data. The
strict-JSON draft contract is the structural trust boundary (action is
enum-validated, confidence clamped to 0..1); both system prompts in
[`lib/agent/draft.ts`](lib/agent/draft.ts) now explicitly instruct the model to
treat evidence and snippets as data, not instructions. A prompt-injection probe
lives in [`lib/agent/draft.test.ts`](lib/agent/draft.test.ts).

### 6. Twelve Data API key encoding (fixed)

The key is now `encodeURIComponent`-encoded in the query string
([`src/adapters/stocks/twelveData.ts`](src/adapters/stocks/twelveData.ts)). Fetch
error paths log only the HTTP status, never the full URL.
