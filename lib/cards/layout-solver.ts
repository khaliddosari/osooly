import type { CardRect, GridDims, SolverCard } from "./types";
import { GRID_COLS, GRID_ROWS } from "./types";

/**
 * The smart-layout solver (PRD §3.5): a pure function from an ordered card
 * list to per-page CSS-grid rects.
 *
 * Rules it implements:
 *  - Fixed grid per page (4×3 = 12 cells by default).
 *  - Cards are packed in order, top-left first, at their declared
 *    defaultSize. Order is the user's order — the solver never reorders.
 *  - If a card's defaultSize doesn't fit in the remaining space, it shrinks
 *    (never below minSize, which defaults to 1×1) to the largest size that
 *    fits.
 *  - If it cannot fit even at minSize, it opens page N+1 (overflow → new
 *    page). Later cards never backfill earlier pages — that would reorder
 *    them visually.
 *  - After packing, cards grow into leftover empty cells so a page never
 *    shows holes: one card alone on a page fills all 12 cells, two fill
 *    2×3 each, and so on.
 */
export const DEFAULT_GRID: GridDims = { cols: GRID_COLS, rows: GRID_ROWS };

export function layoutSolver(
  cards: SolverCard[],
  dims: GridDims = DEFAULT_GRID
): CardRect[] {
  const pages: Page[] = [];
  let current: Page | null = null;

  for (const card of cards) {
    const want = clampSize(card.defaultSize, dims);
    const min = clampSize(card.minSize ?? { w: 1, h: 1 }, dims);

    if (!current) current = newPage(pages, dims);
    let placed = placeCard(current, card.id, want, min);
    if (!placed) {
      current = newPage(pages, dims);
      placed = placeCard(current, card.id, want, min);
    }
    // A fresh page always fits at least minSize (both are clamped to dims),
    // so `placed` cannot be null here.
  }

  for (const page of pages) growToFill(page);

  return pages.flatMap((page, i) =>
    page.rects.map((r) => ({ ...r, page: i + 1 }))
  );
}

/** Groups solved rects by page, in placement order. Pages are 1-based. */
export function rectsByPage(rects: CardRect[]): CardRect[][] {
  const pages: CardRect[][] = [];
  for (const rect of rects) {
    (pages[rect.page - 1] ??= []).push(rect);
  }
  return pages;
}

/* ── internals ────────────────────────────────────────────────────────────── */

interface Page {
  dims: GridDims;
  /** dims.rows × dims.cols occupancy; true = taken. */
  cells: boolean[][];
  rects: Omit<CardRect, "page">[];
}

function newPage(pages: Page[], dims: GridDims): Page {
  const page: Page = {
    dims,
    cells: Array.from({ length: dims.rows }, () =>
      Array<boolean>(dims.cols).fill(false)
    ),
    rects: [],
  };
  pages.push(page);
  return page;
}

function clampSize(
  size: { w: number; h: number },
  dims: GridDims
): { w: number; h: number } {
  return {
    w: Math.max(1, Math.min(Math.floor(size.w), dims.cols)),
    h: Math.max(1, Math.min(Math.floor(size.h), dims.rows)),
  };
}

function fits(page: Page, x: number, y: number, w: number, h: number): boolean {
  if (x + w > page.dims.cols || y + h > page.dims.rows) return false;
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) {
      if (page.cells[r][c]) return false;
    }
  }
  return true;
}

function firstFit(
  page: Page,
  w: number,
  h: number
): { x: number; y: number } | null {
  for (let y = 0; y <= page.dims.rows - h; y++) {
    for (let x = 0; x <= page.dims.cols - w; x++) {
      if (fits(page, x, y, w, h)) return { x, y };
    }
  }
  return null;
}

function occupy(page: Page, rect: Omit<CardRect, "page">): void {
  for (let r = rect.y; r < rect.y + rect.h; r++) {
    for (let c = rect.x; c < rect.x + rect.w; c++) {
      page.cells[r][c] = true;
    }
  }
  page.rects.push(rect);
}

/**
 * Try the declared size first, then every legal shrink down to minSize,
 * preferring the largest area (width wins ties — landscape reads better on a
 * PC dashboard). Returns false when nothing ≥ minSize fits.
 */
function placeCard(
  page: Page,
  cardId: string,
  want: { w: number; h: number },
  min: { w: number; h: number }
): boolean {
  const candidates: { w: number; h: number }[] = [];
  for (let w = want.w; w >= min.w; w--) {
    for (let h = want.h; h >= min.h; h--) {
      candidates.push({ w, h });
    }
  }
  candidates.sort((a, b) => b.w * b.h - a.w * a.h || b.w - a.w);

  for (const { w, h } of candidates) {
    const spot = firstFit(page, w, h);
    if (spot) {
      occupy(page, { cardId, x: spot.x, y: spot.y, w, h });
      return true;
    }
  }
  return false;
}

/**
 * Auto-resize (PRD §3.5): grow placed cards one unit at a time into free
 * cells until the page is as full as rectangles allow. One card on a page
 * ends up 4×3; two default-2×2 cards end up 2×3 each.
 */
function growToFill(page: Page): void {
  let grew = true;
  while (grew) {
    grew = false;
    for (const rect of page.rects) {
      // Try height first so side-by-side cards become full columns before
      // anyone annexes the row below.
      if (
        rect.y + rect.h < page.dims.rows &&
        canClaim(page, rect.x, rect.y + rect.h, rect.w, 1)
      ) {
        claim(page, rect.x, rect.y + rect.h, rect.w, 1);
        rect.h += 1;
        grew = true;
      }
      if (
        rect.x + rect.w < page.dims.cols &&
        canClaim(page, rect.x + rect.w, rect.y, 1, rect.h)
      ) {
        claim(page, rect.x + rect.w, rect.y, 1, rect.h);
        rect.w += 1;
        grew = true;
      }
    }
  }
}

function canClaim(page: Page, x: number, y: number, w: number, h: number): boolean {
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) {
      if (page.cells[r][c]) return false;
    }
  }
  return true;
}

function claim(page: Page, x: number, y: number, w: number, h: number): void {
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) {
      page.cells[r][c] = true;
    }
  }
}
