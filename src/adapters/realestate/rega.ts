import { AdapterError, type FetchLike, type SnapshotWrite } from "../types";

/**
 * REGA / Ministry of Justice transaction index — the *official* primary
 * real-estate source (PRD §3.5). The open-data endpoint is configurable
 * because the portal occasionally reshuffles dataset URLs; point
 * REGA_INDEX_URL at a JSON dataset of city-level index values. Expected
 * rows (defensively parsed): { city, indexValue, period }.
 */
export const REGA_ADAPTER_ID = "rega";

export const DEFAULT_REGA_INDEX_URL =
  "https://api.rega.gov.sa/open-data/real-estate-price-index";

export async function fetchRegaIndex(options: {
  url?: string;
  fetchImpl?: FetchLike;
}): Promise<SnapshotWrite[]> {
  const { url = DEFAULT_REGA_INDEX_URL, fetchImpl = fetch } = options;
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new AdapterError(REGA_ADAPTER_ID, `HTTP ${res.status}`);
  }
  return parseRegaIndex(await res.json());
}

export function parseRegaIndex(body: unknown): SnapshotWrite[] {
  const rows: unknown[] = Array.isArray(body)
    ? body
    : typeof body === "object" && body !== null && Array.isArray((body as { data?: unknown[] }).data)
      ? ((body as { data: unknown[] }).data)
      : [];

  const writes: SnapshotWrite[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const city = String(r.city ?? r.region ?? "").trim();
    const value = Number(r.indexValue ?? r.index_value ?? r.value);
    if (!city || !Number.isFinite(value)) continue;
    writes.push({
      assetClass: "real_estate",
      symbol: city.toLowerCase().replace(/\s+/g, "-"),
      price: value,
      currency: "SAR",
      payload: { kind: "transaction-index", period: r.period ?? null },
      source: REGA_ADAPTER_ID,
    });
  }
  if (writes.length === 0) {
    throw new AdapterError(REGA_ADAPTER_ID, "no index rows in response");
  }
  return writes;
}
