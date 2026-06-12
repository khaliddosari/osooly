import { AdapterError, type FetchLike } from "../types";

/**
 * USD→SAR conversion for the jewelry card — turns the gold-api.com USD/oz
 * spot into the SAR/gram figure the card re-prices the user's gram-weighted
 * inventory with (PRD §3.5).
 *
 * exchangerate.host (the original v1 pick) went behind an apilayer access
 * key in 2026, so the default is the keyless open.er-api.com daily feed;
 * passing an access key switches back to exchangerate.host (PRD §3.10).
 */
export const FX_ADAPTER_ID = "fx-usd-sar";

const OPEN_ER_API_URL = "https://open.er-api.com/v6/latest/USD";
const EXCHANGERATE_HOST_URL =
  "https://api.exchangerate.host/live?source=USD&currencies=SAR";

export const GRAMS_PER_TROY_OUNCE = 31.1034768;

export async function fetchUsdToSar(
  fetchImpl: FetchLike = fetch,
  accessKey?: string
): Promise<number> {
  const url = accessKey
    ? `${EXCHANGERATE_HOST_URL}&access_key=${accessKey}`
    : OPEN_ER_API_URL;
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new AdapterError(FX_ADAPTER_ID, `HTTP ${res.status}`);
  }
  return parseUsdToSar(await res.json());
}

/**
 * Accepts both provider shapes: open.er-api.com `{ rates: { SAR } }` and
 * exchangerate.host `{ quotes: { USDSAR } }`.
 */
export function parseUsdToSar(body: unknown): number {
  const b = body as {
    rates?: { SAR?: unknown };
    quotes?: { USDSAR?: unknown };
  } | null;
  const rate = Number(b?.rates?.SAR ?? b?.quotes?.USDSAR);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new AdapterError(FX_ADAPTER_ID, "no SAR rate in response");
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
