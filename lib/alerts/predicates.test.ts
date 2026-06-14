import { describe, expect, it } from "vitest";
import {
  evaluatePredicate,
  formatPredicate,
  parseChannels,
  parsePredicate,
  type AlertPredicate,
} from "./predicates";

const PRICE_GT_200: AlertPredicate = {
  assetClass: "stocks",
  symbol: "AAPL",
  field: "price",
  op: "gt",
  value: 200,
};

describe("evaluatePredicate", () => {
  it("fires when a price rises above the threshold", () => {
    const r = evaluatePredicate(PRICE_GT_200, { price: 211.5, percentChange: 1 });
    expect(r.matches).toBe(true);
    expect(r.observed).toBe(211.5);
  });

  it("does not fire at or below a strict threshold", () => {
    expect(
      evaluatePredicate(PRICE_GT_200, { price: 200, percentChange: 0 }).matches
    ).toBe(false);
  });

  it("models 'drops 5% from today' as percent_change <= -5", () => {
    const pred: AlertPredicate = {
      assetClass: "jewelry",
      symbol: "XAU",
      field: "percent_change",
      op: "lte",
      value: -5,
    };
    expect(evaluatePredicate(pred, { price: 300, percentChange: -6 }).matches).toBe(
      true
    );
    expect(evaluatePredicate(pred, { price: 300, percentChange: -4 }).matches).toBe(
      false
    );
  });

  it("never matches when the field can't be observed", () => {
    const pred: AlertPredicate = { ...PRICE_GT_200, field: "percent_change" };
    const r = evaluatePredicate(pred, { price: 999, percentChange: null });
    expect(r.matches).toBe(false);
    expect(r.observed).toBeNull();
  });
});

describe("parsePredicate", () => {
  it("accepts a well-formed predicate and coerces a numeric string value", () => {
    const parsed = parsePredicate({
      assetClass: "stocks",
      symbol: " AAPL ",
      field: "price",
      op: "gt",
      value: "200",
    });
    expect(parsed).toEqual({
      assetClass: "stocks",
      symbol: "AAPL",
      field: "price",
      op: "gt",
      value: 200,
    });
  });

  it("rejects unknown classes, fields, ops, blank symbols, and bad values", () => {
    expect(parsePredicate({ ...PRICE_GT_200, assetClass: "crypto" })).toBeNull();
    expect(parsePredicate({ ...PRICE_GT_200, field: "volume" })).toBeNull();
    expect(parsePredicate({ ...PRICE_GT_200, op: "near" })).toBeNull();
    expect(parsePredicate({ ...PRICE_GT_200, symbol: "  " })).toBeNull();
    expect(parsePredicate({ ...PRICE_GT_200, value: "abc" })).toBeNull();
    expect(parsePredicate({ ...PRICE_GT_200, window: "hour" })).toBeNull();
    expect(parsePredicate(null)).toBeNull();
  });
});

describe("parseChannels", () => {
  it("keeps a deduped subset of known channels", () => {
    expect(parseChannels(["email", "email", "telegram"])).toEqual([
      "email",
      "telegram",
    ]);
  });

  it("rejects an empty list or a list with no known channel", () => {
    expect(parseChannels([])).toBeNull();
    expect(parseChannels(["carrier-pigeon"])).toBeNull();
    expect(parseChannels("email")).toBeNull();
  });
});

describe("formatPredicate", () => {
  it("renders a price rule with the currency", () => {
    expect(formatPredicate(PRICE_GT_200, "USD")).toBe("Price rises above 200 USD");
  });

  it("renders a percent rule with a percent sign", () => {
    expect(
      formatPredicate({
        assetClass: "jewelry",
        symbol: "XAU",
        field: "percent_change",
        op: "lte",
        value: -5,
      })
    ).toBe("Daily change is at or below -5%");
  });
});
