import { asNumber } from "@/lib/format";
import { readSnapshots } from "@/lib/market-snapshot";
import {
  fetchJewelryMarketData,
  GOLD_SYMBOL,
} from "@/src/cards/jewelry-market/fetcher";
import { summarizeReading, type ReadingSummary, type ToolImpl } from "../types";

/**
 * Jewelry tools (PRD §3.6): the jewelry sub-agent's read surface over the
 * nightly gold cron's shared-cache rows and the user's gram-weighted
 * inventory.
 */

export interface GoldSpotResult {
  found: boolean;
  /** SAR/gram fine-gold spot plus its FX components. */
  spot:
    | (ReadingSummary & {
        usdPerOunce: number | null;
        usdToSar: number | null;
      })
    | null;
}

export const getGoldSpot: ToolImpl<Record<string, never>, GoldSpotResult> = {
  name: "get_gold_spot",
  description:
    "Read the latest cached SAR/gram fine-gold spot (with its USD/oz and USD-to-SAR components) from the shared market snapshot.",
  inputSchema: { type: "object", properties: {} },
  async run({ db }) {
    const [reading] = await readSnapshots(db, "jewelry", [GOLD_SYMBOL]);
    const summary = summarizeReading(reading);
    return {
      found: summary !== null,
      spot: summary && {
        ...summary,
        usdPerOunce: asNumber(reading?.payload?.usdPerOunce),
        usdToSar: asNumber(reading?.payload?.usdToSar),
      },
    };
  },
};

export interface JewelryValuationResult {
  spot: ReadingSummary | null;
  totalGrams: number;
  /** Spot-repriced inventory total; null while the spot is unusable. */
  totalMarketValueSar: number | null;
  /** Fallback per PRD §3.5a rule 2: user-entered purchase prices. */
  totalPurchaseValue: number;
  pieces: {
    assetId: string;
    name: string;
    grams: number;
    karat: number;
    marketValueSar: number | null;
    purchasePrice: number | null;
    purchaseCurrency: string;
  }[];
}

export const valueJewelryInventory: ToolImpl<
  Record<string, never>,
  JewelryValuationResult
> = {
  name: "value_jewelry_inventory",
  description:
    "Re-price the signed-in user's gram-weighted jewelry inventory at the current spot, adjusted per piece by karat purity.",
  inputSchema: { type: "object", properties: {} },
  async run(ctx) {
    const data = await fetchJewelryMarketData(ctx);
    return {
      spot: summarizeReading(data.spot),
      totalGrams: data.totalGrams,
      totalMarketValueSar: data.totalMarketValueSar,
      totalPurchaseValue: data.totalPurchaseValue,
      pieces: data.pieces,
    };
  },
};

export { GOLD_SYMBOL };

export const jewelryToolImpls = [getGoldSpot, valueJewelryInventory] as const;
