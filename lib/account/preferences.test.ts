import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, parsePreferences } from "./preferences";

describe("parsePreferences", () => {
  it("returns defaults for missing or non-object input", () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("en")).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences({})).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps a valid locale and falls back on an unknown one", () => {
    expect(parsePreferences({ locale: "ar" }).locale).toBe("ar");
    expect(parsePreferences({ locale: "fr" }).locale).toBe("en");
  });

  it("normalises the currency to an upper-case 3-letter code", () => {
    expect(parsePreferences({ displayCurrency: "usd" }).displayCurrency).toBe("USD");
    expect(parsePreferences({ displayCurrency: " aed " }).displayCurrency).toBe("AED");
  });

  it("falls back to SAR for a malformed currency", () => {
    expect(parsePreferences({ displayCurrency: "dollars" }).displayCurrency).toBe("SAR");
    expect(parsePreferences({ displayCurrency: 42 }).displayCurrency).toBe("SAR");
  });
});
