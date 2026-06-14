import { getCloudflareContext } from "@opennextjs/cloudflare";
import { agentEnvFromBindings, missingProviderKeys } from "@/lib/agent/env";
import { runAgentForUser } from "@/lib/agent/orchestrator";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { makeRagStore } from "@/lib/rag/vectorize";

/**
 * POST /api/agent/run: run the S6 orchestrator for the signed-in user and
 * write fresh Recommendation rows (PRD §3.6). Cards re-read them on the
 * next dashboard render; the RecommendationList refresh button calls this
 * then refreshes the route.
 *
 * The per-user monthly token cap (PRD §3.9) is enforced here once S10
 * lands the counters; until then this endpoint is session-gated only.
 *
 * A state-changing POST that runs solely on the ambient session cookie is a
 * CSRF target (it spends LLM tokens, and will spend billed quota once S10
 * lands the cap). We reject any cross-site request before touching the
 * session so a malicious page cannot trigger a run via the victim's cookie.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: "Cross-site requests are not allowed." },
      { status: 403 }
    );
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json(
      { error: "Sign in to run the analyst." },
      { status: 401 }
    );
  }

  const { env } = await getCloudflareContext({ async: true });
  const agentEnv = agentEnvFromBindings(env);
  const missing = missingProviderKeys(agentEnv);
  if (missing.length > 0) {
    return Response.json(
      { error: `Agent models are not configured (missing ${missing.join(", ")}).` },
      { status: 503 }
    );
  }

  try {
    const db = await getDb();
    const result = await runAgentForUser({
      db,
      userId,
      env: agentEnv,
      rag: makeRagStore(env),
    });
    return Response.json(result);
  } catch (error) {
    console.error("[agent] run failed:", error);
    return Response.json(
      { error: "The analyst run failed; nothing was written." },
      { status: 500 }
    );
  }
}

/**
 * Same-origin guard (CSRF defense). Modern browsers stamp every request with
 * `Sec-Fetch-Site`; we trust it when present and only allow `same-origin`
 * (the dashboard's own fetch) or `none` (a direct, non-cross-site load, which
 * cannot be a forged POST). When the header is absent (older clients), we fall
 * back to comparing the `Origin` host against `Host`. A POST with neither
 * header is treated as suspicious and rejected.
 */
function isSameOriginRequest(request: Request): boolean {
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
