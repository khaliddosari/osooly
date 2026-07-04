import { describe, expect, it } from "vitest";
import { parseAssetInput } from "./schema";

describe("parseAssetInput", () => {
  it("accepts a minimal holding (name + class), defaulting the rest", () => {
    const input = parseAssetInput({ name: "  Aramco  ", assetClass: "stocks" });
    expect(input).not.toBeNull();
    expect(input).toMatchObject({
      name: "Aramco",
      assetClass: "stocks",
      symbol: null,
      quantity: 1,
      purchasePrice: null,
      purchaseCurrency: "SAR",
      purchasedAt: null,
      note: null,
    });
  });

  it("rejects a holding with no name or an unknown class", () => {
    expect(parseAssetInput({ name: "  ", assetClass: "stocks" })).toBeNull();
    expect(parseAssetInput({ name: "X", assetClass: "crypto" })).toBeNull();
    expect(parseAssetInput(null)).toBeNull();
    expect(parseAssetInput("nope")).toBeNull();
  });

  it("keeps a valid quantity but floors non-positive / non-numeric to 1", () => {
    expect(parseAssetInput({ name: "A", assetClass: "jewelry", quantity: 12.5 })?.quantity).toBe(12.5);
    expect(parseAssetInput({ name: "A", assetClass: "jewelry", quantity: 0 })?.quantity).toBe(1);
    expect(parseAssetInput({ name: "A", assetClass: "jewelry", quantity: -3 })?.quantity).toBe(1);
    expect(parseAssetInput({ name: "A", assetClass: "jewelry", quantity: "abc" })?.quantity).toBe(1);
  });

  it("normalises the currency to a 3-letter ISO code, defaulting to SAR", () => {
    expect(parseAssetInput({ name: "A", assetClass: "stocks", purchaseCurrency: "usd" })?.purchaseCurrency).toBe("USD");
    expect(parseAssetInput({ name: "A", assetClass: "stocks", purchaseCurrency: "dollars" })?.purchaseCurrency).toBe("SAR");
    expect(parseAssetInput({ name: "A", assetClass: "stocks" })?.purchaseCurrency).toBe("SAR");
  });

  it("drops a malformed purchase date but keeps a valid one", () => {
    expect(parseAssetInput({ name: "A", assetClass: "autos", purchasedAt: "2026-07-04" })?.purchasedAt).toBe("2026-07-04");
    expect(parseAssetInput({ name: "A", assetClass: "autos", purchasedAt: "07/04/2026" })?.purchasedAt).toBeNull();
  });

  it("ignores a negative purchase price", () => {
    expect(parseAssetInput({ name: "A", assetClass: "stocks", purchasePrice: 250 })?.purchasePrice).toBe(250);
    expect(parseAssetInput({ name: "A", assetClass: "stocks", purchasePrice: -5 })?.purchasePrice).toBeNull();
  });
});
