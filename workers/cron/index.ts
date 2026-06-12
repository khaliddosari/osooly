import { refreshAutos } from "./autos";
import {
  CRON_AUTOS,
  CRON_GOLD,
  CRON_NEWS,
  CRON_REAL_ESTATE,
  CRON_STOCKS,
  type CronEnv,
} from "./config";
import { refreshGold } from "./gold";
import { refreshNews } from "./news-refresh";
import { refreshRealEstate } from "./realestate";
import { refreshStocks } from "./stocks";

/**
 * The market-refresh Cron Worker (PRD §3.6): one Worker, four triggers —
 * Cloudflare passes the matching cron expression in controller.cron and we
 * dispatch on it. Cadences (UTC; AST = UTC+3):
 *
 *   stocks       * 7-11 * * 0-4   every minute, Sun–Thu 10:00–14:59 AST
 *                                  (Tadawul trading hours)
 *   jewelry      0 22 * * *        nightly 01:00 AST
 *   autos        30 22 * * *       nightly 01:30 AST
 *   real estate  0 23 * * *        nightly 02:00 AST
 *   news corpus  30 23 * * *       nightly 02:30 AST (RAG, PRD 3.6)
 *
 * Run locally with:
 *   npx wrangler dev --config workers/cron/wrangler.toml --test-scheduled
 *   curl "http://localhost:8787/__scheduled?cron=0+22+*+*+*"
 *
 * A failed refresh logs and exits cleanly — last-known market_snapshot rows
 * stay put and age into the stale badge (PRD §3.5a rule 2). Throwing here
 * would only make Cloudflare retry into the same outage.
 */

const JOBS: Record<string, (env: CronEnv) => Promise<void>> = {
  [CRON_STOCKS]: refreshStocks,
  [CRON_GOLD]: refreshGold,
  [CRON_AUTOS]: refreshAutos,
  [CRON_REAL_ESTATE]: refreshRealEstate,
  [CRON_NEWS]: refreshNews,
};

export default {
  async scheduled(
    controller: ScheduledController,
    env: CronEnv
  ): Promise<void> {
    const job = JOBS[controller.cron];
    if (!job) {
      console.error(
        JSON.stringify({ event: "cron.unknown", cron: controller.cron })
      );
      return;
    }
    const startedAt = Date.now();
    try {
      await job(env);
      console.log(
        JSON.stringify({
          event: "cron.ok",
          cron: controller.cron,
          ms: Date.now() - startedAt,
        })
      );
    } catch (error) {
      // Degrade, don't crash: snapshots keep their last-known values.
      console.error(
        JSON.stringify({
          event: "cron.failed",
          cron: controller.cron,
          ms: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  },
};
