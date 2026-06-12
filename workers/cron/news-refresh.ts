import { feedsFromEnv, refreshNewsCorpus } from "../../lib/rag/embed-news";
import { makeRagStore, NullRagStore } from "../../lib/rag/vectorize";
import type { CronEnv } from "./config";
import { politeContact } from "./scrape-targets";

/**
 * News-corpus refresh (nightly, PRD §3.6): pull the per-class RSS feeds and
 * upsert them into the shared Vectorize news collection. Without the AI +
 * VECTORIZE bindings (local dev, or pre-S10 deploys) the job logs a skip;
 * the agent then simply runs with less context.
 */
export async function refreshNews(env: CronEnv): Promise<void> {
  const store = makeRagStore(env);
  if (store instanceof NullRagStore) {
    console.log(
      JSON.stringify({
        event: "news.skipped",
        reason: "AI/VECTORIZE bindings not configured",
      })
    );
    return;
  }

  const report = await refreshNewsCorpus(
    store,
    (url, init) => fetch(url, init),
    feedsFromEnv(env.NEWS_FEEDS),
    politeContact(env)
  );
  console.log(JSON.stringify({ event: "news.refresh", ...report }));
}
