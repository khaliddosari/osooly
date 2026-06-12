import type { CardServerContext } from "@/lib/cards/server-context";
import type { AssetClass, Freshness } from "@/lib/market-snapshot";

/**
 * One sub-agent per asset class (PRD §3.6). A sub-agent owns its card's
 * tools and turns them into per-asset evidence bundles; the orchestrator
 * handles drafting, escalation, and persistence uniformly so the four
 * classes can't drift apart in behavior.
 *
 * Evidence is gathered deterministically (every tool, every asset) instead
 * of letting the model free-form tool-call: the tool surface is small
 * enough to read in full, and a bounded run is what keeps the per-user
 * token cap (PRD §3.9) enforceable.
 */
export interface AssetEvidence {
  assetId: string;
  assetName: string;
  /** Tool outputs, JSON-stringified into the model brief as-is. */
  evidence: Record<string, unknown>;
}

export interface SubAgent {
  assetClass: AssetClass;
  cardId: string;
  gather(ctx: CardServerContext): Promise<AssetEvidence[]>;
}

const FRESHNESS_VALUES: readonly string[] = ["fresh", "stale", "unavailable"];

/**
 * Every reading summary in an evidence bundle carries a `freshness` field;
 * collect them so the staleness confidence cap (PRD §3.5a rule 2) sees the
 * whole bundle without each sub-agent bookkeeping its own list.
 */
export function collectFreshness(value: unknown): Freshness[] {
  const found: Freshness[] = [];
  walk(value, found, 0);
  return found;
}

function walk(value: unknown, found: Freshness[], depth: number): void {
  if (depth > 6 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, found, depth + 1);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === "freshness" && FRESHNESS_VALUES.includes(String(child))) {
      found.push(child as Freshness);
    } else {
      walk(child, found, depth + 1);
    }
  }
}

/** The user's assets in one class; the per-asset loop every gather() runs. */
export async function listClassAssets(
  ctx: CardServerContext,
  assetClass: AssetClass
): Promise<{ id: string; name: string }[]> {
  if (!ctx.userId) return [];
  const { results } = await ctx.db
    .prepare(
      `SELECT id, name FROM assets
       WHERE user_id = ?1 AND asset_class = '${assetClass}'
       ORDER BY name`
    )
    .bind(ctx.userId)
    .all<{ id: string; name: string }>();
  return results;
}
