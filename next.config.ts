import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Expose the wrangler.toml bindings (D1, .dev.vars secrets) to `next dev`
// through getCloudflareContext(). No-op outside dev.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {};

export default nextConfig;
