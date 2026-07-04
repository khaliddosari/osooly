import { getCloudflareContext } from "@opennextjs/cloudflare";
import { agentEnvFromBindings, missingProviderKeys } from "@/lib/agent/env";
import { runAgentForUser } from "@/lib/agent/orchestrator";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/http/same-origin";
import { checkBudget } from "@/lib/limits/token-budget";
import { recordTokenUsage } from "@/lib/limits/token-usage";
import { logError, logEvent } from "@/lib/observability/log";
import { makeRagStore } from "@/lib/rag/vectorize";

/**
 * POST /api/agent/run: run the S6 orchestrator for the signed-in user and
 * write fresh Recommendation rows (PRD §3.6). Cards re-read them on the
 * next dashboard render; the RecommendationList refresh button calls this
 * then refreshes the route.
 *
 * The per-user monthly token cap (PRD §3.9) is enforced here (S10): the run is
 * refused with a 429 when the user has no monthly allowance left, and the
 * tokens the run spends are recorded to the counter afterward. The cap resets
 * each calendar month (lib/limits/token-usage.ts).
 *
 * A state-changing POST that runs solely on the ambient session cookie is a
 * CSRF target (it spends LLM tokens, and billed quota). We reject any
 * cross-site request before touching the session so a malicious page cannot
 * trigger a run via the victim's cookie.
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

  const db = await getDb();

  // Per-user monthly token cap (PRD §3.9): refuse a fresh run once the month's
  // allowance is spent, before touching the models, so the user gets a clear
  // limit message rather than a mid-run failure or a silent overspend.
  const budget = await checkBudget(db, userId);
  if (!budget.allowed) {
    logEvent("agent.run.refused", {
      userId,
      reason: "over_budget",
      used: budget.usage.used,
      cap: budget.usage.cap,
    });
    return Response.json(
      {
        error:
          "You've reached this month's AI usage limit. It resets on the 1st of next month.",
        usage: { used: budget.usage.used, cap: budget.usage.cap },
      },
      { status: 429 }
    );
  }

  try {
    const result = await runAgentForUser({
      db,
      userId,
      env: agentEnv,
      rag: makeRagStore(env),
    });
    // Meter the run against the cap. A failed run recorded nothing (the catch
    // below), so only a completed run's tokens count.
    await recordTokenUsage(db, userId, result.tokensUsed);
    logEvent("agent.run.completed", {
      userId,
      written: result.written,
      classes: result.classes,
      tokens: result.tokensUsed,
    });
    return Response.json(result);
  } catch (error) {
    logError("agent.run.failed", error, { userId });
    return Response.json(
      { error: "The analyst run failed; nothing was written." },
      { status: 500 }
    );
  }
}
