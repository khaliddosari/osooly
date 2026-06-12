import { describe, expect, it } from "vitest";
import { ANCIENT_UTC, fakeDb } from "../testing";
import { fetchJewelryMarketData, GOLD_SYMBOL } from "./fetcher";

const USER = "user-1";

describe("fetchJewelryMarketData", () => {
  it("re-prices the gram-weighted inventory at the cached spot, by karat", async () => {
    const db = fakeDb({
      snapshots: [
        {
          assetClass: "jewelry",
          symbol: GOLD_SYMBOL,
          price: 450,
          payload: { usdPerOunce: 3300, usdToSar: 3.75, unit: "SAR/gram" },
        },
      ],
      assets: [
        {
          id: "j1",
          user_id: USER,
          asset_class: "jewelry",
          name: "Bridal set",
          quantity: 10,
          details: JSON.stringify({ karat: 21 }),
        },
        {
          id: "j2",
          user_id: USER,
          asset_class: "jewelry",
          name: "Gold bar",
          quantity: 20,
        },
      ],
    });

    const data = await fetchJewelryMarketData({ db, userId: USER });
    expect(data.spot?.price).toBe(450);
    // 10g at 21k: 10 × 0.875 × 450
    expect(data.pieces[0].marketValueSar).toBe(3937.5);
    // karat defaults to 24 (fine gold) when details are absent
    expect(data.pieces[1].karat).toBe(24);
    expect(data.pieces[1].marketValueSar).toBe(9000);
    expect(data.totalGrams).toBe(30);
    expect(data.totalMarketValueSar).toBe(12_937.5);
  });

  it("nulls market values when the spot is unavailable, keeping purchase totals", async () => {
    const db = fakeDb({
      snapshots: [
        {
          assetClass: "jewelry",
          symbol: GOLD_SYMBOL,
          price: 450,
          fetchedAt: ANCIENT_UTC,
        },
      ],
      assets: [
        {
          id: "j1",
          user_id: USER,
          asset_class: "jewelry",
          name: "Bridal set",
          quantity: 10,
          purchase_price: 4200,
        },
      ],
    });

    const data = await fetchJewelryMarketData({ db, userId: USER });
    expect(data.spot?.freshness).toBe("unavailable");
    expect(data.pieces[0].marketValueSar).toBeNull();
    expect(data.totalMarketValueSar).toBeNull();
    expect(data.totalPurchaseValue).toBe(4200);
  });

  it("tolerates malformed details and missing spot rows", async () => {
    const db = fakeDb({
      assets: [
        {
          id: "j1",
          user_id: USER,
          asset_class: "jewelry",
          name: "Pendant",
          quantity: 5,
          details: "{not json",
        },
      ],
    });

    const data = await fetchJewelryMarketData({ db, userId: USER });
    expect(data.spot).toBeNull();
    expect(data.pieces[0].karat).toBe(24);
    expect(data.pieces[0].marketValueSar).toBeNull();
  });
});
