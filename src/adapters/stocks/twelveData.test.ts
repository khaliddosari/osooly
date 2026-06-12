import { describe, expect, it } from "vitest";
import { AdapterError } from "../types";
import { parseQuoteResponse } from "./twelveData";

describe("parseQuoteResponse", () => {
  it("parses a single-symbol response", () => {
    const writes = parseQuoteResponse(
      {
        symbol: "TASI",
        close: "12345.67",
        currency: "SAR",
        percent_change: "0.42",
        is_market_open: true,
      },
      ["TASI"]
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      assetClass: "stocks",
      symbol: "TASI",
      price: 12345.67,
      currency: "SAR",
      source: "twelve-data",
    });
    expect(writes[0].payload).toMatchObject({
      percentChange: 0.42,
      isMarketOpen: true,
    });
  });

  it("parses a batch response keyed by symbol", () => {
    const writes = parseQuoteResponse(
      {
        TASI: { symbol: "TASI", close: "12000", currency: "SAR" },
        SPX: { symbol: "SPX", close: "6100.5", currency: "USD" },
      },
      ["TASI", "SPX"]
    );
    expect(writes.map((w) => [w.symbol, w.price])).toEqual([
      ["TASI", 12000],
      ["SPX", 6100.5],
    ]);
  });

  it("skips per-symbol errors so last-known rows survive", () => {
    const writes = parseQuoteResponse(
      {
        TASI: { symbol: "TASI", close: "12000", currency: "SAR" },
        BAD: { status: "error", code: 400, message: "symbol not found" },
      },
      ["TASI", "BAD"]
    );
    expect(writes.map((w) => w.symbol)).toEqual(["TASI"]);
  });

  it("throws on a top-level error (bad key / rate limit)", () => {
    expect(() =>
      parseQuoteResponse(
        { status: "error", code: 429, message: "limit reached" },
        ["TASI"]
      )
    ).toThrow(AdapterError);
  });
});
