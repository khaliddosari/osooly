import { AdapterError, type FetchLike } from "../types";

/**
 * gold-api.com free gold spot (PRD §3.5) — keyless JSON, replaced
 * metals.live in June 2026 after that service went dark for good (TLS
 * handshake failures, confirmed dead from both shell and Workers runtime).
 * A thrown AdapterError leaves the last-known market_snapshot row in place
 * and the jewelry card shows the stale badge (PRD §3.5a rule 2).
 */
export const GOLD_API_ADAPTER_ID = "gold-api";

const SPOT_URL = "https://api.gold-api.com/price/XAU";

/** Spot gold in USD per troy ounce. */
export async function fetchGoldSpotUsd(
  fetchImpl: FetchLike = fetch
): Promise<number> {
  const res = await fetchImpl(SPOT_URL);
  if (!res.ok) {
    throw new AdapterError(GOLD_API_ADAPTER_ID, `HTTP ${res.status}`);
  }
  return parseSpotResponse(await res.json());
}

/** Response shape: { name: "Gold", symbol: "XAU", price: 4185.6, updatedAt: … } */
export function parseSpotResponse(body: unknown): number {
  if (typeof body === "object" && body !== null && "price" in body) {
    const price = Number((body as { price: unknown }).price);
    if (Number.isFinite(price) && price > 0) return price;
  }
  throw new AdapterError(GOLD_API_ADAPTER_ID, "no gold price in response");
}
