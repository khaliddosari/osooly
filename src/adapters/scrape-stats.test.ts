import { describe, expect, it } from "vitest";
import { extractPrices, slugify, summarize } from "./scrape-stats";

describe("extractPrices", () => {
  it("finds comma-grouped and plain prices inside the band", () => {
    const html = `
      <div class="listing">تويوتا لاند كروزر 2020 — 345,000 ريال</div>
      <div class="listing">Land Cruiser GXR <b>360000</b> SAR</div>
      <div class="listing">399,500</div>
      <span class="phone">0551234567</span>
      <span class="year">2020</span>`;
    expect(extractPrices(html, { min: 10_000, max: 2_000_000 })).toEqual([
      345_000, 360_000, 399_500,
    ]);
  });

  it("ignores out-of-band numbers (years, phones, ids)", () => {
    expect(
      extractPrices("id 98765432109 year 2021 price 950", {
        min: 10_000,
        max: 2_000_000,
      })
    ).toEqual([]);
  });
});

describe("summarize", () => {
  it("reports median/min/max/sampleCount", () => {
    expect(summarize([300_000, 360_000, 345_000, 399_500])).toEqual({
      median: 352_500,
      min: 300_000,
      max: 399_500,
      sampleCount: 4,
    });
  });

  it("returns null when there are too few samples to trust", () => {
    expect(summarize([345_000, 360_000])).toBeNull();
  });
});

describe("slugify", () => {
  it("builds snapshot symbols from make/model and cities", () => {
    expect(slugify("Toyota", "Land Cruiser")).toBe("toyota-land-cruiser");
    expect(slugify("Riyadh")).toBe("riyadh");
    expect(slugify("الرياض")).toBe("الرياض");
  });
});
