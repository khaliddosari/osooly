import { describe, expect, it } from "vitest";
import { AdapterError } from "../types";
import { parseSpotResponse } from "./goldApi";

describe("parseSpotResponse", () => {
  it("parses the gold-api.com price shape", () => {
    // Live shape as of June 2026.
    expect(
      parseSpotResponse({
        currency: "USD",
        name: "Gold",
        price: 4185.600098,
        symbol: "XAU",
        updatedAt: "2026-06-12T02:48:22Z",
      })
    ).toBeCloseTo(4185.6, 1);
  });

  it("throws AdapterError on a price-less or malformed body", () => {
    expect(() => parseSpotResponse({ name: "Gold" })).toThrow(AdapterError);
    expect(() => parseSpotResponse({ price: "not-a-number" })).toThrow(AdapterError);
    expect(() => parseSpotResponse(null)).toThrow(AdapterError);
  });
});
