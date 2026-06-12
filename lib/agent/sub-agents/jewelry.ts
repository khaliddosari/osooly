import {
  getGoldSpot,
  valueJewelryInventory,
  type GoldSpotResult,
  type JewelryValuationResult,
} from "@/src/agent/tools/jewelry";
import { bindStructuredTool } from "../structured-tools";
import type { SubAgent } from "./types";

/**
 * Jewelry sub-agent (PRD §3.6): the whole inventory is re-priced once at
 * the cached spot, then each piece gets its own evidence bundle so the
 * recommendation lands on a concrete asset row.
 */
export const jewelrySubAgent: SubAgent = {
  assetClass: "jewelry",
  cardId: "jewelry-market",
  async gather(ctx) {
    const spotTool = bindStructuredTool(getGoldSpot, ctx);
    const inventoryTool = bindStructuredTool(valueJewelryInventory, ctx);

    const [spot, inventory] = await Promise.all([
      spotTool.invoke({}) as Promise<GoldSpotResult>,
      inventoryTool.invoke({}) as Promise<JewelryValuationResult>,
    ]);

    return inventory.pieces.map((piece) => ({
      assetId: piece.assetId,
      assetName: piece.name,
      evidence: {
        piece,
        spot: spot.spot,
        inventoryTotals: {
          totalGrams: inventory.totalGrams,
          totalMarketValueSar: inventory.totalMarketValueSar,
          totalPurchaseValue: inventory.totalPurchaseValue,
        },
      },
    }));
  },
};
