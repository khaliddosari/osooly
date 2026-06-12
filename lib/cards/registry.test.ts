import { describe, expect, it } from "vitest";
import { layoutSolver } from "./layout-solver";
import { getCard, listCards, listCardsByCategory } from "./registry";
import { GRID_COLS, GRID_ROWS } from "./types";

/** PRD §3.5 catalogue order. */
const V1_CARD_IDS = [
  "stock-market",
  "real-estate-market",
  "automobile-market",
  "jewelry-market",
];

describe("card registry (S5)", () => {
  it("ships the four v1 market cards in catalogue order", () => {
    expect(listCards().map((card) => card.id)).toEqual(V1_CARD_IDS);
  });

  it("every card honours the CardDefinition contract", () => {
    for (const card of listCards()) {
      expect(card.category).toBe("market");
      expect(card.title.length).toBeGreaterThan(0);
      expect(card.defaultSize.w).toBeLessThanOrEqual(GRID_COLS);
      expect(card.defaultSize.h).toBeLessThanOrEqual(GRID_ROWS);
      if (card.minSize) {
        expect(card.minSize.w).toBeLessThanOrEqual(card.defaultSize.w);
        expect(card.minSize.h).toBeLessThanOrEqual(card.defaultSize.h);
      }
      expect(typeof card.Component).toBe("function");
      expect(typeof card.fetcher).toBe("function");
      expect(getCard(card.id)).toBe(card);
    }
  });

  it("declares agent tools as loud S6 stubs, never silent fakes", async () => {
    for (const card of listCards()) {
      expect(card.agentTools?.length).toBeGreaterThan(0);
      for (const tool of card.agentTools ?? []) {
        expect(tool.name).toMatch(/^[a-z_]+$/);
        expect(tool.description.length).toBeGreaterThan(0);
        await expect(tool.invoke({})).rejects.toThrow(/S6/);
      }
    }
  });

  it("groups all four under Market for the Customize sheet", () => {
    const groups = listCardsByCategory();
    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe("market");
    expect(groups[0].cards).toHaveLength(4);
  });

  it("fits the whole v1 catalogue on a single dashboard page", () => {
    const rects = layoutSolver(
      listCards().map((card) => ({
        id: card.id,
        defaultSize: card.defaultSize,
        minSize: card.minSize,
      }))
    );
    expect(rects).toHaveLength(4);
    expect(rects.every((rect) => rect.page === 1)).toBe(true);
  });
});
