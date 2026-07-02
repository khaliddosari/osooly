import { runAutoml, type RunAutomlOutcome } from "@/src/agent/tools/automl";
import {
  estimatePropertyValue,
  type PropertyValueResult,
} from "@/src/agent/tools/real-estate";
import { bindStructuredTool } from "../structured-tools";
import { listClassAssets, type SubAgent } from "./types";

/**
 * Real-estate sub-agent (PRD §3.6): per saved property, the valuation tool
 * joins the city's REGA index and Aqar comparables to the purchase record.
 * Since S8 the bundle also carries a Namtheg AutoML projection trained on
 * the user's own transaction ledger (run_automl, PRD §3.7): one class-level
 * run per gather, attached to every property. The tool guards itself
 * (unconfigured sidecar or a thin ledger comes back as `ran: false`), so
 * only real runs reach the drafting model.
 */
export const realEstateSubAgent: SubAgent = {
  assetClass: "real_estate",
  cardId: "real-estate-market",
  async gather(ctx) {
    const valuationTool = bindStructuredTool(estimatePropertyValue, ctx);
    const automlTool = bindStructuredTool(runAutoml, ctx);
    const properties = await listClassAssets(ctx, "real_estate");
    if (properties.length === 0) return [];

    let automlProjection: RunAutomlOutcome | null = null;
    try {
      const outcome = (await automlTool.invoke({
        assetClass: "real_estate",
        target: "price",
        maxWaitSeconds: 60,
      })) as RunAutomlOutcome;
      if (outcome.ran) automlProjection = outcome;
    } catch (error) {
      console.error("[agent] real-estate AutoML projection failed:", error);
    }

    return Promise.all(
      properties.map(async (property) => {
        const valuation = (await valuationTool.invoke({
          assetId: property.id,
        })) as PropertyValueResult;
        return {
          assetId: property.id,
          assetName: property.name,
          evidence: automlProjection
            ? { valuation, automlProjection }
            : { valuation },
        };
      })
    );
  },
};
