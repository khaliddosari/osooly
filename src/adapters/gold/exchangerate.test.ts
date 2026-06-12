import { describe, expect, it } from "vitest";
import { AdapterError } from "../types";
import { parseUsdToSar, usdPerOunceToSarPerGram } from "./exchangerate";

describe("parseUsdToSar", () => {
  it("parses the keyless open.er-api.com shape", () => {
    expect(parseUsdToSar({ result: "success", rates: { SAR: 3.75 } })).toBe(3.75);
  });

  it("parses the keyed exchangerate.host shape", () => {
    expect(parseUsdToSar({ success: true, quotes: { USDSAR: 3.7501 } })).toBe(3.7501);
  });

  it("throws AdapterError when no usable rate is present", () => {
    // exchangerate.host's missing_access_key error body lands here too.
    expect(() => parseUsdToSar({ success: false, error: { code: 101 } })).toThrow(
      AdapterError
    );
    expect(() => parseUsdToSar(null)).toThrow(AdapterError);
  });
});

describe("usdPerOunceToSarPerGram", () => {
  it("converts the USD/oz spot to SAR/gram", () => {
    // 2000 USD/oz × 3.75 SAR/USD ÷ 31.1034768 g/oz ≈ 241.13 SAR/g
    expect(usdPerOunceToSarPerGram(2000, 3.75)).toBeCloseTo(241.13, 2);
  });
});
