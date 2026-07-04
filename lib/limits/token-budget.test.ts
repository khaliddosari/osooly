import { describe, expect, it } from "vitest";
import { MONTHLY_TOKEN_CAP } from "./token-usage";
import { checkBudget } from "./token-budget";

/** Minimal D1 stub: getMonthlyTokenUsage issues one SELECT ... first(). */
function usageDb(tokens: number | null): D1Database {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => (tokens === null ? null : { tokens }),
      }),
    }),
  } as unknown as D1Database;
}

describe("checkBudget", () => {
  it("allows a run when the user has never spent tokens", async () => {
    const result = await checkBudget(usageDb(null), "u1");
    expect(result.allowed).toBe(true);
    expect(result.usage.used).toBe(0);
  });

  it("allows a run while under the cap", async () => {
    const result = await checkBudget(usageDb(MONTHLY_TOKEN_CAP / 2), "u1");
    expect(result.allowed).toBe(true);
  });

  it("refuses a run once the cap is reached", async () => {
    const result = await checkBudget(usageDb(MONTHLY_TOKEN_CAP), "u1");
    expect(result.allowed).toBe(false);
    expect(result.usage.remaining).toBe(0);
  });

  it("refuses a run when over the cap", async () => {
    const result = await checkBudget(usageDb(MONTHLY_TOKEN_CAP + 5000), "u1");
    expect(result.allowed).toBe(false);
  });
});
