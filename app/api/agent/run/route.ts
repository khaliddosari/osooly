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
 */
export async function POST(): Promise<Response> {
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
