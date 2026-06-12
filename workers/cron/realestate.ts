import { upsertSnapshots, type SnapshotWrite } from "../../lib/market-snapshot";
import { PoliteFetcher } from "../../src/adapters/polite-fetch";
import { fetchAqarCityListing } from "../../src/adapters/realestate/aqar";
import { fetchRegaIndex } from "../../src/adapters/realestate/rega";
import type { CronEnv } from "./config";
import { politeContact } from "./scrape-targets";

/**
 * Real-estate refresh (nightly): the official REGA/MoJ transaction index is
 * primary; Aqar live comparables are layered on top per city users hold
 * property in (PRD §3.5). The two sources fail independently.
 */
const DEFAULT_CITIES = ["Riyadh", "Jeddah", "Dammam"];

export async function refreshRealEstate(env: CronEnv): Promise<void> {
  const writes: SnapshotWrite[] = [];
  const failures: string[] = [];

  try {
    writes.push(...(await fetchRegaIndex({ url: env.REGA_INDEX_URL })));
  } catch (error) {
    failures.push(`rega: ${error instanceof Error ? error.message : error}`);
  }

  const polite = new PoliteFetcher({ contact: politeContact(env) });
  for (const city of await trackedCities(env)) {
    try {
      writes.push(await fetchAqarCityListing(polite, city));
    } catch (error) {
      failures.push(
        `aqar ${city}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  await upsertSnapshots(env.DB, writes);
  console.log(
    JSON.stringify({
      event: "realestate.refresh",
      written: writes.length,
      failures,
    })
  );
}

/** Default cities plus any city users saved on a property (details JSON). */
async function trackedCities(env: CronEnv): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT details FROM assets
     WHERE asset_class = 'real_estate' AND details IS NOT NULL`
  ).all<{ details: string }>();

  const cities = new Map<string, string>(
    DEFAULT_CITIES.map((c) => [c.toLowerCase(), c])
  );
  for (const row of results) {
    try {
      const details = JSON.parse(row.details) as { city?: unknown };
      const city = String(details.city ?? "").trim();
      if (city) cities.set(city.toLowerCase(), city);
    } catch {
      // Skip malformed rows; same rationale as autos.ts.
    }
  }
  return [...cities.values()];
}
