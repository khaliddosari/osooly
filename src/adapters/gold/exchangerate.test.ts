import { describe, expect, it } from "vitest";
import { usdPerOunceToSarPerGram } from "./exchangerate";

describe("usdPerOunceToSarPerGram", () => {
  it("converts the metals.live USD/oz spot to SAR/gram", () => {
    // 2000 USD/oz × 3.75 SAR/USD ÷ 31.1034768 g/oz ≈ 241.13 SAR/g
    expect(usdPerOunceToSarPerGram(2000, 3.75)).toBeCloseTo(241.13, 2);
  });
});
