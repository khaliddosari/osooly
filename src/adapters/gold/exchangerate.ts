import { AdapterError, type FetchLike } from "../types";

/**
 * exchangerate.host — converts the metals.live USD/oz spot into the SAR/gram
 * figure the jewelry card re-prices the user's gram-weighted inventory with
 * (PRD §3.5).
 */
export const EXCHANGERATE_ADAPTER_ID = "exchangerate-host";

const RATE_URL = "https://api.exchangerate.host/latest?base=USD&symbols=SAR";

export const GRAMS_PER_TROY_OUNCE = 31.1034768;

export async function fetchUsdToSar(
  fetchImpl: FetchLike = fetch
): Promise<number> {
  const res = await fetchImpl(RATE_URL);
  if (!res.ok) {
    throw new AdapterError(EXCHANGERATE_ADAPTER_ID, `HTTP ${res.status}`);
  }
  const body = (await res.json()) as { rates?: { SAR?: unknown } };
  const rate = Number(body?.rates?.SAR);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new AdapterError(EXCHANGERATE_ADAPTER_ID, "no SAR rate in response");
  }
  return rate;
}

/** USD per troy ounce → SAR per gram. */
export function usdPerOunceToSarPerGram(
  usdPerOunce: number,
  usdToSar: number
): number {
  return (usdPerOunce * usdToSar) / GRAMS_PER_TROY_OUNCE;
}
