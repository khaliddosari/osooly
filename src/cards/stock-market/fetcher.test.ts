import { describe, expect, it } from "vitest";
import { ANCIENT_UTC, fakeDb, hoursAgoUtc } from "../testing";
import { fetchStockMarketData, TASI_SYMBOL } from "./fetcher";

const USER = "user-1";

describe("fetchStockMarketData", () => {
  it("joins holdings to their shared-cache quotes plus the TASI index", async () => {
    const db = fakeDb({
      snapshots: [
        {
          assetClass: "stocks",
          symbol: TASI_SYMBOL,
          price: 12_345.6,
          payload: { percentChange: 0.8 },
        },
        { assetClass: "stocks", symbol: "2222", price: 27.5 },
      ],
      assets: [
        {
          id: "a1",
          user_id: USER,
          asset_class: "stocks",
          name: "Aramco",
          symbol: "2222",
          quantity: 100,
          purchase_price: 30,
        },
      ],
    });

    const data = await fetchStockMarketData({ db, userId: USER });
    expect(data.index?.price).toBe(12_345.6);
    expect(data.index?.freshness).toBe("fresh");
    expect(data.holdings).toHaveLength(1);
    expect(data.holdings[0].snapshot?.price).toBe(27.5);
    expect(data.holdings[0].quantity).toBe(100);
  });

  it("returns the index alone when signed out", async () => {
    const db = fakeDb({
      snapshots: [
        { assetClass: "stocks", symbol: TASI_SYMBOL, price: 12_000 },
      ],
    });

    const data = await fetchStockMarketData({ db, userId: null });
    expect(data.index?.price).toBe(12_000);
    expect(data.holdings).toEqual([]);
  });

  it("leaves snapshot null for symbols the cron has never written", async () => {
    const db = fakeDb({
      assets: [
        {
          id: "a1",
          user_id: USER,
          asset_class: "stocks",
          name: "Apple",
          symbol: "AAPL",
        },
      ],
    });

    const data = await fetchStockMarketData({ db, userId: USER });
    expect(data.index).toBeNull();
    expect(data.holdings[0].snapshot).toBeNull();
  });

  it("derives staleness instead of throwing when refreshes stop", async () => {
    const db = fakeDb({
      snapshots: [
        {
          assetClass: "stocks",
          symbol: TASI_SYMBOL,
          price: 11_900,
          fetchedAt: hoursAgoUtc(5),
        },
      ],
    });

    const data = await fetchStockMarketData({ db, userId: null });
    expect(data.index?.freshness).toBe("stale");
    expect(data.index?.staleLabel).toMatch(/^stale \(last updated/);
  });

  it("marks long-dead quotes unavailable so the card falls back to user-entered values", async () => {
    const db = fakeDb({
      snapshots: [
        {
          assetClass: "stocks",
          symbol: "2222",
          price: 27.5,
          fetchedAt: ANCIENT_UTC,
        },
      ],
      assets: [
        {
          id: "a1",
          user_id: USER,
          asset_class: "stocks",
          name: "Aramco",
          symbol: "2222",
        },
      ],
    });

    const data = await fetchStockMarketData({ db, userId: USER });
    expect(data.holdings[0].snapshot?.freshness).toBe("unavailable");
  });
});
