import { describe, expect, it } from "vitest";
import { fakeDb } from "../testing";
import { fetchRealEstateMarketData } from "./fetcher";

const USER = "user-1";

const RIYADH_SNAPSHOTS = [
  {
    assetClass: "real_estate" as const,
    symbol: "riyadh",
    price: 112.4,
    payload: { kind: "transaction-index", period: "2026-05" },
    source: "rega",
  },
  {
    assetClass: "real_estate" as const,
    symbol: "riyadh:aqar",
    price: 1_450_000,
    payload: { kind: "live-comparables", city: "Riyadh", sampleCount: 40 },
    source: "aqar",
  },
];

describe("fetchRealEstateMarketData", () => {
  it("scopes city trends to the cities the user holds property in", async () => {
    const db = fakeDb({
      snapshots: [
        ...RIYADH_SNAPSHOTS,
        {
          assetClass: "real_estate",
          symbol: "jeddah",
          price: 104.1,
          source: "rega",
        },
      ],
      assets: [
        {
          id: "p1",
          user_id: USER,
          asset_class: "real_estate",
          name: "Family villa",
          purchase_price: 1_800_000,
          details: JSON.stringify({ city: "Riyadh" }),
        },
      ],
    });

    const data = await fetchRealEstateMarketData({ db, userId: USER });
    expect(data.cities).toHaveLength(1);
    expect(data.cities[0].city).toBe("Riyadh");
    expect(data.cities[0].index?.price).toBe(112.4);
    expect(data.cities[0].comparables?.price).toBe(1_450_000);
    expect(data.properties[0].purchasePrice).toBe(1_800_000);
  });

  it("shows every tracked city when the user has no properties yet", async () => {
    const db = fakeDb({
      snapshots: [
        ...RIYADH_SNAPSHOTS,
        {
          assetClass: "real_estate",
          symbol: "jeddah",
          price: 104.1,
          source: "rega",
        },
      ],
    });

    const data = await fetchRealEstateMarketData({ db, userId: USER });
    expect(data.cities.map((c) => c.city)).toEqual(["Jeddah", "Riyadh"]);
    expect(data.properties).toEqual([]);
  });

  it("keeps a city visible when only one source has data", async () => {
    const db = fakeDb({
      snapshots: [
        {
          assetClass: "real_estate",
          symbol: "dammam",
          price: 98.7,
          source: "rega",
        },
      ],
    });

    const data = await fetchRealEstateMarketData({ db, userId: null });
    expect(data.cities[0].city).toBe("Dammam");
    expect(data.cities[0].index?.price).toBe(98.7);
    expect(data.cities[0].comparables).toBeNull();
  });

  it("lists a property with malformed details without a city", async () => {
    const db = fakeDb({
      assets: [
        {
          id: "p1",
          user_id: USER,
          asset_class: "real_estate",
          name: "Plot",
          details: "{not json",
        },
      ],
    });

    const data = await fetchRealEstateMarketData({ db, userId: USER });
    expect(data.properties[0].city).toBeNull();
    expect(data.cities).toEqual([]);
  });
});
