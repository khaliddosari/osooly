import { describe, expect, it, vi } from "vitest";
import {
  MONTHLY_TOKEN_CAP,
  currentPeriod,
  recordTokenUsage,
  summarizeUsage,
} from "./token-usage";

describe("currentPeriod", () => {
  it("formats the calendar month as UTC 'YYYY-MM'", () => {
    expect(currentPeriod(new Date("2026-07-04T09:00:00Z"))).toBe("2026-07");
    expect(currentPeriod(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01");
  });
});

describe("summarizeUsage", () => {
  const now = new Date("2026-07-04T00:00:00Z");

  it("reports zero usage with a full remaining balance", () => {
    const u = summarizeUsage(0, now);
    expect(u).toMatchObject({
      period: "2026-07",
      used: 0,
      cap: MONTHLY_TOKEN_CAP,
      fraction: 0,
      remaining: MONTHLY_TOKEN_CAP,
    });
  });

  it("computes the consumed fraction and remaining balance", () => {
    const u = summarizeUsage(MONTHLY_TOKEN_CAP / 4, now);
    expect(u.fraction).toBeCloseTo(0.25);
    expect(u.remaining).toBe((MONTHLY_TOKEN_CAP * 3) / 4);
  });

  it("clamps an over-cap count to fraction 1 and zero remaining", () => {
    const u = summarizeUsage(MONTHLY_TOKEN_CAP * 2, now);
    expect(u.fraction).toBe(1);
    expect(u.remaining).toBe(0);
    expect(u.used).toBe(MONTHLY_TOKEN_CAP * 2);
  });

  it("treats negative or non-finite counts as zero", () => {
    expect(summarizeUsage(-100, now).used).toBe(0);
    expect(summarizeUsage(Number.NaN, now).used).toBe(0);
  });
});

describe("recordTokenUsage", () => {
  function spyDb() {
    const run = vi.fn(async () => ({}));
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    return { db: { prepare } as unknown as D1Database, prepare, bind, run };
  }

  it("skips the write for a zero, negative, or non-finite delta", async () => {
    const { db, prepare } = spyDb();
    await recordTokenUsage(db, "u1", 0);
    await recordTokenUsage(db, "u1", -50);
    await recordTokenUsage(db, "u1", Number.NaN);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("upserts a rounded token delta for a positive count", async () => {
    const { db, bind, run } = spyDb();
    await recordTokenUsage(db, "u1", 123.6);
    expect(run).toHaveBeenCalledOnce();
    expect(bind).toHaveBeenCalledWith("u1", expect.any(String), 124);
  });
});
