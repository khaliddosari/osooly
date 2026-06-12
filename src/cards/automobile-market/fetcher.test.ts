import { describe, expect, it } from "vitest";
import { ANCIENT_UTC, fakeDb } from "../testing";
import { fetchAutoMarketData } from "./fetcher";

const USER = "user-1";

function landCruiser(overrides: Record<string, unknown> = {}) {
  return {
    id: "v1",
    user_id: USER,
    asset_class: "autos" as const,
    name: "My Land Cruiser",
    purchase_price: 300_000,
    details: JSON.stringify({ make: "Toyota", model: "Land Cruiser", year: 2020 }),
    ...overrides,
  };
}

describe("fetchAutoMarketData", () => {
  it("joins each vehicle to its Syarah and Haraj medians and averages them", async () => {
    const db = fakeDb({
      snapshots: [
        {
          assetClass: "autos",
          symbol: "toyota-land-cruiser",
          price: 250_000,
          payload: { sampleCount: 18 },
          source: "syarah",
        },
        {
          assetClass: "autos",
          symbol: "toyota-land-cruiser:haraj",
          price: 230_000,
          source: "haraj",
        },
      ],
      assets: [landCruiser()],
    });

    const data = await fetchAutoMarketData({ db, userId: USER });
    const vehicle = data.vehicles[0];
    expect(vehicle.make).toBe("Toyota");
    expect(vehicle.year).toBe(2020);
    expect(vehicle.dealer?.price).toBe(250_000);
    expect(vehicle.privateMarket?.price).toBe(230_000);
    expect(vehicle.estimateSar).toBe(240_000);
  });

  it("estimates from the one usable source when the other has aged out", async () => {
    const db = fakeDb({
      snapshots: [
        {
          assetClass: "autos",
          symbol: "toyota-land-cruiser",
          price: 250_000,
          fetchedAt: ANCIENT_UTC,
        },
        {
          assetClass: "autos",
          symbol: "toyota-land-cruiser:haraj",
          price: 230_000,
        },
      ],
      assets: [landCruiser()],
    });

    const data = await fetchAutoMarketData({ db, userId: USER });
    expect(data.vehicles[0].dealer?.freshness).toBe("unavailable");
    expect(data.vehicles[0].estimateSar).toBe(230_000);
  });

  it("lists vehicles with no scrape rows yet, estimate null", async () => {
    const db = fakeDb({ assets: [landCruiser()] });

    const data = await fetchAutoMarketData({ db, userId: USER });
    expect(data.vehicles).toHaveLength(1);
    expect(data.vehicles[0].dealer).toBeNull();
    expect(data.vehicles[0].estimateSar).toBeNull();
  });

  it("keeps a vehicle with malformed details visible, unpriced", async () => {
    const db = fakeDb({
      assets: [landCruiser({ details: "{not json" })],
    });

    const data = await fetchAutoMarketData({ db, userId: USER });
    expect(data.vehicles[0].make).toBeNull();
    expect(data.vehicles[0].estimateSar).toBeNull();
    expect(data.vehicles[0].purchasePrice).toBe(300_000);
  });

  it("returns no vehicles when signed out", async () => {
    const db = fakeDb({});
    const data = await fetchAutoMarketData({ db, userId: null });
    expect(data.vehicles).toEqual([]);
  });
});
