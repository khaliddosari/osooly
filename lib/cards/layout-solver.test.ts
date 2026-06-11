import { describe, expect, it } from "vitest";
import { layoutSolver, rectsByPage } from "./layout-solver";
import type { CardRect, SolverCard } from "./types";

/** A mocked card injected into the platform, per the S3 acceptance test. */
function mockCard(
  id: string,
  defaultSize: { w: number; h: number } = { w: 2, h: 2 },
  minSize?: { w: number; h: number }
): SolverCard {
  return { id, defaultSize, minSize };
}

function cells(rect: CardRect): number {
  return rect.w * rect.h;
}

function assertNoOverlapNoOverflow(rects: CardRect[]) {
  for (const page of rectsByPage(rects)) {
    const seen = new Set<string>();
    for (const rect of page) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(4);
      expect(rect.y + rect.h).toBeLessThanOrEqual(3);
      for (let r = rect.y; r < rect.y + rect.h; r++) {
        for (let c = rect.x; c < rect.x + rect.w; c++) {
          const key = `${r}:${c}`;
          expect(seen.has(key), `cell ${key} claimed twice`).toBe(false);
          seen.add(key);
        }
      }
    }
  }
}

describe("layoutSolver", () => {
  it("returns an empty layout for zero cards (empty-state dashboard)", () => {
    expect(layoutSolver([])).toEqual([]);
  });

  it("expands a single card to fill the whole 4×3 page", () => {
    const [rect] = layoutSolver([mockCard("solo")]);
    expect(rect).toMatchObject({ cardId: "solo", page: 1, x: 0, y: 0, w: 4, h: 3 });
  });

  it("gives two cards half the page each (2×3)", () => {
    const rects = layoutSolver([mockCard("a"), mockCard("b")]);
    expect(rects).toHaveLength(2);
    for (const rect of rects) {
      expect(rect.page).toBe(1);
      expect({ w: rect.w, h: rect.h }).toEqual({ w: 2, h: 3 });
    }
    assertNoOverlapNoOverflow(rects);
  });

  it("keeps three cards on one page with no holes", () => {
    const rects = layoutSolver([mockCard("a"), mockCard("b"), mockCard("c")]);
    expect(rects.every((r) => r.page === 1)).toBe(true);
    expect(rects.reduce((sum, r) => sum + cells(r), 0)).toBe(12);
    assertNoOverlapNoOverflow(rects);
  });

  it("never reorders: rects come back in the input card order", () => {
    const ids = ["first", "second", "third", "fourth"];
    const rects = layoutSolver(ids.map((id) => mockCard(id)));
    expect(rects.map((r) => r.cardId)).toEqual(ids);
  });

  it("packs every count from 1 to 12 with no overlap and no page holes", () => {
    for (let n = 1; n <= 12; n++) {
      const rects = layoutSolver(
        Array.from({ length: n }, (_, i) => mockCard(`card-${i}`))
      );
      expect(rects).toHaveLength(n);
      assertNoOverlapNoOverflow(rects);
      // Every page except the last must be completely full — holes only
      // ever appear when rectangles can't tile, which 2×2 defaults avoid.
      const pages = rectsByPage(rects);
      for (const page of pages.slice(0, -1)) {
        expect(page.reduce((sum, r) => sum + cells(r), 0)).toBe(12);
      }
    }
  });

  it("fits twelve 1×1 cards on a single page", () => {
    const rects = layoutSolver(
      Array.from({ length: 12 }, (_, i) => mockCard(`s${i}`, { w: 1, h: 1 }))
    );
    expect(rects.every((r) => r.page === 1)).toBe(true);
    expect(rects.reduce((sum, r) => sum + cells(r), 0)).toBe(12);
  });

  it("shrinks a card to fit remaining space instead of paginating", () => {
    // 3×2 + 2×2: the second card can't fit at default next to the first,
    // but a legal shrink keeps it on page 1.
    const rects = layoutSolver([
      mockCard("wide", { w: 3, h: 2 }),
      mockCard("flex", { w: 2, h: 2 }),
    ]);
    expect(rects.every((r) => r.page === 1)).toBe(true);
    assertNoOverlapNoOverflow(rects);
    expect(rects.reduce((sum, r) => sum + cells(r), 0)).toBe(12);
  });

  it("opens a new page when minSize cannot fit (overflow → page N+1)", () => {
    const rects = layoutSolver([
      mockCard("big", { w: 4, h: 2 }, { w: 4, h: 2 }),
      mockCard("rigid", { w: 2, h: 2 }, { w: 2, h: 2 }),
    ]);
    expect(rects[0].page).toBe(1);
    expect(rects[1].page).toBe(2);
    // Alone on page 2, the overflow card grows to fill it.
    expect({ w: rects[1].w, h: rects[1].h }).toEqual({ w: 4, h: 3 });
  });

  it("never shrinks below a declared minSize", () => {
    const rects = layoutSolver([
      mockCard("a", { w: 2, h: 3 }, { w: 2, h: 3 }),
      mockCard("b", { w: 2, h: 3 }, { w: 2, h: 3 }),
      mockCard("c", { w: 2, h: 3 }, { w: 2, h: 3 }),
    ]);
    for (const rect of rects) {
      expect(rect.w).toBeGreaterThanOrEqual(2);
      expect(rect.h).toBeGreaterThanOrEqual(3);
    }
    // Two fit page 1; the third overflows.
    expect(rectsByPage(rects).length).toBe(2);
  });

  it("clamps oversized declarations to the grid instead of crashing", () => {
    const [rect] = layoutSolver([mockCard("huge", { w: 9, h: 9 })]);
    expect({ w: rect.w, h: rect.h }).toEqual({ w: 4, h: 3 });
  });

  it("paginates a long mixed feed deterministically", () => {
    const cards = [
      mockCard("a", { w: 4, h: 3 }),
      mockCard("b", { w: 2, h: 2 }),
      mockCard("c", { w: 1, h: 1 }),
      mockCard("d", { w: 3, h: 1 }),
      mockCard("e", { w: 2, h: 3 }, { w: 2, h: 2 }),
      mockCard("f", { w: 4, h: 1 }),
    ];
    const first = layoutSolver(cards);
    const second = layoutSolver(cards);
    expect(second).toEqual(first);
    assertNoOverlapNoOverflow(first);
    expect(rectsByPage(first).length).toBeGreaterThan(1);
  });
});
