import type React from "react";
import type { IconName } from "@/components/icon";

/**
 * The card developer contract (PRD §3.5). Adding a card is one folder under
 * `src/cards/<card-id>/` exporting a CardDefinition, plus one line in
 * lib/cards/registry.ts.
 */

/** Grid units. The dashboard grid is a fixed 4 columns × 3 rows per page. */
export const GRID_COLS = 4;
export const GRID_ROWS = 3;

export interface GridSize {
  w: 1 | 2 | 3 | 4;
  h: 1 | 2 | 3;
}

export type CardCategory = "market" | "portfolio" | "tools";

/**
 * What a mounted card receives from the platform. `size` is the solved size
 * in grid units (≥ minSize, possibly grown past defaultSize to fill the
 * page); `data` is the resolved `fetcher` payload once cards ship (S5).
 */
export interface CardProps {
  size: { w: number; h: number };
  data?: unknown;
}

/**
 * A LangChain-shaped tool stub. The asset-class sub-agents (S6) wrap these
 * into StructuredTools when the owning card is mounted; until then the type
 * only pins the contract so S5 cards can declare their tools.
 */
export interface AgentTool {
  name: string;
  description: string;
  /** JSON-schema-ish description of the tool input (S6 formalises this). */
  inputSchema?: Record<string, unknown>;
  invoke: (input: unknown) => Promise<unknown>;
}

export interface CardDefinition {
  id: string; // "stock-market"
  title: string; // "Stock Market"
  icon: IconName; // FA semantic name (see design-system §4)
  category: CardCategory;
  defaultSize: GridSize;
  /** Smallest size the solver may shrink to. Defaults to 1×1 when omitted. */
  minSize?: { w: number; h: number };
  Component: React.FC<CardProps>;
  fetcher?: () => Promise<unknown>;
  /** Tools the asset-class agent registers when this card is mounted (S6). */
  agentTools?: AgentTool[];
}

/* ── Layout solver types ──────────────────────────────────────────────────── */

export interface GridDims {
  cols: number;
  rows: number;
}

/** What the solver needs to know about a card — a CardDefinition subset. */
export interface SolverCard {
  id: string;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
}

/**
 * One solved placement, in grid units. Pages are 1-based (matches
 * user_dashboard_layout.page); x/y are 0-based within the page.
 */
export interface CardRect {
  cardId: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}
