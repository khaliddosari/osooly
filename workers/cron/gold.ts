import { upsertSnapshots } from "../../lib/market-snapshot";
import {
  fetchUsdToSar,
  usdPerOunceToSarPerGram,
} from "../../src/adapters/gold/exchangerate";
import {
  fetchGoldSpotUsd,
  GOLD_API_ADAPTER_ID,
} from "../../src/adapters/gold/goldApi";

import type { CronEnv } from "./config";

/**
 * Jewelry refresh (nightly): gold-api.com spot × USD→SAR (open.er-api.com,
 * or exchangerate.host when EXCHANGERATE_ACCESS_KEY is set), stored as
 * SAR/gram under the one symbol the jewelry card reads ("XAU"). Either
 * upstream failing throws — the dispatcher logs it and yesterday's row
 * ages into the stale badge.
 */
export async function refreshGold(env: CronEnv): Promise<void> {
  const [usdPerOunce, usdToSar] = await Promise.all([
    fetchGoldSpotUsd(),
    fetchUsdToSar(undefined, env.EXCHANGERATE_ACCESS_KEY),
  ]);
  const sarPerGram = usdPerOunceToSarPerGram(usdPerOunce, usdToSar);

  await upsertSnapshots(env.DB, [
    {
      assetClass: "jewelry",
      symbol: "XAU",
      price: sarPerGram,
      currency: "SAR",
      payload: { usdPerOunce, usdToSar, unit: "SAR/gram" },
      source: GOLD_API_ADAPTER_ID,
    },
  ]);
  console.log(
    JSON.stringify({ event: "gold.refresh", sarPerGram, usdPerOunce })
  );
}
