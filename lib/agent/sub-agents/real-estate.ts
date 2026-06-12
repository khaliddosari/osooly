import {
  estimatePropertyValue,
  type PropertyValueResult,
} from "@/src/agent/tools/real-estate";
import { bindStructuredTool } from "../structured-tools";
import { listClassAssets, type SubAgent } from "./types";

/**
 * Real-estate sub-agent (PRD §3.6): per saved property, the valuation tool
 * joins the city's REGA index and Aqar comparables to the purchase record.
 * The AutoML projection (run_automl, PRD §3.7) joins this bundle in S8.
 */
export const realEstateSubAgent: SubAgent = {
  assetClass: "real_estate",
  cardId: "real-estate-market",
  async gather(ctx) {
    const valuationTool = bindStructuredTool(estimatePropertyValue, ctx);
    const properties = await listClassAssets(ctx, "real_estate");

    return Promise.all(
      properties.map(async (property) => {
        const valuation = (await valuationTool.invoke({
          assetId: property.id,
        })) as PropertyValueResult;
        return {
          assetId: property.id,
          assetName: property.name,
          evidence: { valuation },
        };
      })
    );
  },
};
