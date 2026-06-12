import type { CardServerContext } from "@/lib/cards/server-context";
import type { AssetClass } from "@/lib/market-snapshot";

/**
 * The supervisor node's routing decision (PRD §3.6): which asset-class
 * sub-agents have work this run. v1 routes deterministically on the ledger
 * (a class runs when the user holds at least one asset in it); recommending
 * against assets the user doesn't own would just burn the token budget.
 * The LLM-side cheap/expensive split lives in the per-asset draft flow
 * (lib/agent/models/router.ts), not here.
 */
export interface ClassPlan {
  assetClass: AssetClass;
  assetCount: number;
}

const ASSET_CLASSES: readonly AssetClass[] = [
  "stocks",
  "real_estate",
  "autos",
  "jewelry",
];

export async function buildPlan(ctx: CardServerContext): Promise<ClassPlan[]> {
  if (!ctx.userId) return [];
  const { results } = await ctx.db
    .prepare(`SELECT asset_class FROM assets WHERE user_id = ?1`)
    .bind(ctx.userId)
    .all<{ asset_class: AssetClass }>();

  const counts = new Map<AssetClass, number>();
  for (const row of results) {
    counts.set(row.asset_class, (counts.get(row.asset_class) ?? 0) + 1);
  }
  return ASSET_CLASSES.flatMap((assetClass) => {
    const assetCount = counts.get(assetClass) ?? 0;
    return assetCount > 0 ? [{ assetClass, assetCount }] : [];
  });
}
