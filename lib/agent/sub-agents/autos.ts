import {
  estimateVehicleDepreciation,
  type VehicleDepreciationResult,
} from "@/src/agent/tools/autos";
import { bindStructuredTool } from "../structured-tools";
import { listClassAssets, type SubAgent } from "./types";

/**
 * Autos sub-agent (PRD §3.6): per saved vehicle, the depreciation tool
 * already joins the Syarah + Haraj medians to the purchase price, so one
 * tool call per asset is the whole evidence bundle.
 */
export const autosSubAgent: SubAgent = {
  assetClass: "autos",
  cardId: "automobile-market",
  async gather(ctx) {
    const depreciationTool = bindStructuredTool(estimateVehicleDepreciation, ctx);
    const vehicles = await listClassAssets(ctx, "autos");

    return Promise.all(
      vehicles.map(async (vehicle) => {
        const depreciation = (await depreciationTool.invoke({
          assetId: vehicle.id,
        })) as VehicleDepreciationResult;
        return {
          assetId: vehicle.id,
          assetName: vehicle.name,
          evidence: { depreciation },
        };
      })
    );
  },
};
