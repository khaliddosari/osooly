/**
 * Same-origin guard (CSRF defense) for state-changing API routes. Modern
 * browsers stamp every request with `Sec-Fetch-Site`; we trust it when present
 * and only allow `same-origin` (the app's own fetch) or `none` (a direct,
 * non-cross-site load, which cannot be a forged POST). When the header is
 * absent (older clients), we compare the `Origin` host against `Host`. A
 * mutation with neither header is treated as suspicious and rejected.
 *
 * Shared by every cookie-authenticated mutation (POST /api/agent/run, the
 * /api/alerts CRUD) so the check can't drift between routes.
 */
export function isSameOriginRequest(request: Request): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite !== null) {
    return secFetchSite === "same-origin" || secFetchSite === "none";
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin === null || host === null) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
