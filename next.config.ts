import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Expose the wrangler.toml bindings (D1, .dev.vars secrets) to `next dev`
// through getCloudflareContext(). No-op outside dev.
initOpenNextCloudflareForDev();

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy tuned to what the app actually loads:
 * - Google Fonts CSS (fonts.googleapis.com) and font files (fonts.gstatic.com)
 * - Font Awesome 6.5.1 from cdnjs.cloudflare.com (CSS + font files)
 * See app/layout.tsx for those <link> tags.
 *
 * `script-src` keeps 'unsafe-inline' because Next's app router injects inline
 * hydration/streaming scripts with no nonce; the app deliberately ships no
 * middleware (avoids CVE-2025-29927), which is where a nonce would be minted.
 * 'unsafe-eval' is dev-only (React Refresh / HMR), as is the ws: connect-src.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
  "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // 'self' plus Google: NextAuth's sign-in form POSTs same-origin, then the
  // server 302s to Google's OAuth consent screen - browsers enforce
  // form-action against that redirect hop too, not just the initial target.
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
