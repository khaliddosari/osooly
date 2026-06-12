import { upsertSnapshots } from "../../lib/market-snapshot";
import {
  fetchUsdToSar,
  usdPerOunceToSarPerGram,
} from "../../src/adapters/gold/exchangerate";
import {
  fetchGoldSpotUsd,
  METALS_LIVE_ADAPTER_ID,
} from "../../src/adapters/gold/metalsLive";

import type { CronEnv } from "./config";

/**
 * Jewelry refresh (nightly): metals.live spot × exchangerate.host USD→SAR,
 * stored as SAR/gram under the one symbol the jewelry card reads ("XAU").
 * Either upstream failing throws — the dispatcher logs it and yesterday's
 * row ages into the stale badge.
 */
export async function refreshGold(env: CronEnv): Promise<void> {
  const [usdPerOunce, usdToSar] = await Promise.all([
    fetchGoldSpotUsd(),
    fetchUsdToSar(),
  ]);
  const sarPerGram = usdPerOunceToSarPerGram(usdPerOunce, usdToSar);

  await upsertSnapshots(env.DB, [
    {
      assetClass: "jewelry",
      symbol: "XAU",
      price: sarPerGram,
      currency: "SAR",
      payload: { usdPerOunce, usdToSar, unit: "SAR/gram" },
      source: METALS_LIVE_ADAPTER_ID,
    },
  ]);
  console.log(
    JSON.stringify({ event: "gold.refresh", sarPerGram, usdPerOunce })
  );
}
