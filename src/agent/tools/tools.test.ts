import { describe, expect, it } from "vitest";
import { fakeDb, hoursAgoUtc } from "@/src/cards/testing";
import { estimateVehicleDepreciation } from "./autos";
import { getGoldSpot } from "./jewelry";
import { getCityPriceIndex } from "./real-estate";
import { getStockQuote, listStockHoldings } from "./stocks";

const USER = "user-1";

describe("getStockQuote", () => {
  it("reads the cached quote with its percent change", async () => {
    const db = fakeDb({
      snapshots: [
        {
          assetClass: "stocks",
          symbol: "2222",
          price: 27.5,
          payload: { percentChange: -1.2 },
        },
      ],
    });
    const result = await getStockQuote.run({ db, userId: USER }, { symbol: "2222" });
    expect(result.found).toBe(true);
    expect(result.quote?.price).toBe(27.5);
    expect(result.quote?.percentChange).toBe(-1.2);
    expect(result.quote?.freshness).toBe("fresh");
  });

  it("reports unknown symbols instead of throwing", async () => {
    const db = fakeDb({});
    const result = await getStockQuote.run({ db, userId: USER }, { symbol: "9999" });
    expect(result).toEqual({ symbol: "9999", found: false, quote: null });
  });
});

describe("listStockHoldings", () => {
  it("computes cost basis and market value per holding", async () => {
    const db = fakeDb({
      snapshots: [{ assetClass: "stocks", symbol: "2222", price: 27.5 }],
      assets: [
        {
          id: "s1",
          user_id: USER,
          asset_class: "stocks",
          name: "Aramco",
          symbol: "2222",
          quantity: 100,
          purchase_price: 30,
        },
      ],
    });
    const result = await listStockHoldings.run({ db, userId: USER }, {});
    expect(result.holdings).toHaveLength(1);
    expect(result.holdings[0].costBasis).toBe(3000);
    expect(result.holdings[0].marketValue).toBe(2750);
  });
});

describe("getGoldSpot", () => {
  it("returns the SAR/gram spot with FX components", async () => {
    const db = fakeDb({
      snapshots: [
        {
          assetClass: "jewelry",
          symbol: "XAU",
          price: 451.2,
          payload: { usdPerOunce: 3300, usdToSar: 3.75 },
        },
      ],
    });
    const result = await getGoldSpot.run({ db, userId: USER }, {});
    expect(result.spot?.price).toBe(451.2);
    expect(result.spot?.usdPerOunce).toBe(3300);
  });
});

describe("estimateVehicleDepreciation", () => {
  it("computes the change against the mean of the usable medians", async () => {
    const db = fakeDb({
      snapshots: [
        { assetClass: "autos", symbol: "toyota-land-cruiser", price: 320_000 },
        { assetClass: "autos", symbol: "toyota-land-cruiser:haraj", price: 290_000 },
      ],
      assets: [
        {
          id: "a1",
          user_id: USER,
          asset_class: "autos",
          name: "Family car",
          purchase_price: 350_000,
          details: '{"make":"Toyota","model":"Land Cruiser","year":2020}',
        },
      ],
    });
    const result = await estimateVehicleDepreciation.run(
      { db, userId: USER },
      { assetId: "a1" }
    );
    expect(result.found).toBe(true);
    expect(result.estimateSar).toBe(305_000);
    expect(result.changePct).toBeCloseTo(-12.86, 2);
  });

  it("refuses to read other users' vehicles", async () => {
    const db = fakeDb({
      assets: [
        {
          id: "a1",
          user_id: "someone-else",
          asset_class: "autos",
          name: "Not yours",
        },
      ],
    });
    const result = await estimateVehicleDepreciation.run(
      { db, userId: USER },
      { assetId: "a1" }
    );
    expect(result.found).toBe(false);
  });
});

describe("getCityPriceIndex", () => {
  it("joins the REGA index and the Aqar comparable by city slug", async () => {
    const db = fakeDb({
      snapshots: [
        { assetClass: "real_estate", symbol: "riyadh", price: 103.4 },
        {
          assetClass: "real_estate",
          symbol: "riyadh:aqar",
          price: 5_400,
          fetchedAt: hoursAgoUtc(60),
        },
      ],
    });
    const result = await getCityPriceIndex.run(
      { db, userId: USER },
      { city: "Riyadh" }
    );
    expect(result.slug).toBe("riyadh");
    expect(result.index?.price).toBe(103.4);
    expect(result.comparables?.freshness).toBe("stale");
  });
});
