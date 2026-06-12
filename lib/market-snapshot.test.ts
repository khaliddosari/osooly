import { describe, expect, it } from "vitest";
import { deriveFreshness, formatAge } from "./market-snapshot";

const NOW = new Date("2026-06-11T12:00:00Z");

describe("deriveFreshness", () => {
  it("marks a just-written stocks row fresh, with no badge", () => {
    const r = deriveFreshness("stocks", "2026-06-11 11:59:30", NOW);
    expect(r.freshness).toBe("fresh");
    expect(r.staleLabel).toBeNull();
  });

  it("keeps overnight stock gaps fresh (markets close — not a failure)", () => {
    const r = deriveFreshness("stocks", "2026-06-11 11:15:00", NOW);
    expect(r.freshness).toBe("fresh");
  });

  it("surfaces a stale badge instead of an exception when refreshes stop", () => {
    // An injected adapter failure means the row simply stops being
    // rewritten — the last-known value ages into "stale" (PRD §3.5a rule 2).
    const r = deriveFreshness("jewelry", "2026-06-08 12:00:00", NOW);
    expect(r.freshness).toBe("stale");
    expect(r.staleLabel).toBe("stale (last updated 3d ago)");
  });

  it("falls back to user-entered values after prolonged failure", () => {
    const r = deriveFreshness("autos", "2026-06-01 12:00:00", NOW);
    expect(r.freshness).toBe("unavailable");
    expect(r.staleLabel).toBe(
      "market data unavailable, showing user-entered values"
    );
  });

  it("treats SQLite timestamps as UTC regardless of host timezone", () => {
    const r = deriveFreshness("stocks", "2026-06-11 11:59:00", NOW);
    expect(r.ageMs).toBe(60_000);
  });
});

describe("formatAge", () => {
  it("formats minutes, hours, and days", () => {
    expect(formatAge(5 * 60_000)).toBe("5m");
    expect(formatAge(3 * 36e5)).toBe("3h");
    expect(formatAge(72 * 36e5)).toBe("3d");
  });

  it("never says 0m", () => {
    expect(formatAge(1000)).toBe("1m");
  });
});
