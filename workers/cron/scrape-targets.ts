import type { CronEnv } from "./config";

/** Contact in the scraper UA (PRD §3.5a rule 3) — override per deploy. */
export function politeContact(env: CronEnv): string {
  return env.SCRAPER_CONTACT ?? "osooly.app";
}
