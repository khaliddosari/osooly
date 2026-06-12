import { AdapterError, type FetchLike } from "../types";

/**
 * metals.live free gold spot (PRD §3.5). Known for spotty uptime — that's
 * exactly the graceful-degradation case of PRD §3.5a rule 2: a thrown
 * AdapterError leaves the last-known market_snapshot row in place and the
 * jewelry card shows the stale badge.
 */
export const METALS_LIVE_ADAPTER_ID = "metals-live";

const SPOT_URL = "https://api.metals.live/v1/spot";

/** Spot gold in USD per troy ounce. */
export async function fetchGoldSpotUsd(
  fetchImpl: FetchLike = fetch
): Promise<number> {
  const res = await fetchImpl(SPOT_URL);
  if (!res.ok) {
    throw new AdapterError(METALS_LIVE_ADAPTER_ID, `HTTP ${res.status}`);
  }
  return parseSpotResponse(await res.json());
}

/**
 * The endpoint has shipped several shapes over time —
 * `[{"gold": 2034.1}, {"silver": …}]`, `[["timestamp", 2034.1], …]`, and
 * `{"gold": 2034.1}` — so parse by hunting for a plausible gold number
 * rather than trusting one schema.
 */
export function parseSpotResponse(body: unknown): number {
  const candidates: unknown[] = Array.isArray(body) ? body : [body];
  for (const entry of candidates) {
    if (typeof entry === "object" && entry !== null && "gold" in entry) {
      const price = Number((entry as { gold: unknown }).gold);
      if (Number.isFinite(price) && price > 0) return price;
    }
    if (Array.isArray(entry) && entry.length >= 2) {
      const price = Number(entry[1]);
      if (Number.isFinite(price) && price > 0) return price;
    }
  }
  throw new AdapterError(METALS_LIVE_ADAPTER_ID, "no gold price in response");
}
