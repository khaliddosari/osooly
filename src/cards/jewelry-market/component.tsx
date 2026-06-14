"use client";

import { AlertRuleForm, type AlertTarget } from "@/components/alert-rule-form";
import { CardDataFallback, FreshnessBadge } from "@/components/card-status";
import { RecommendationList } from "@/components/recommendation-list";
import type { CardProps } from "@/lib/cards/types";
import { asNumber, formatMoney } from "@/lib/format";
import { usableReading } from "@/lib/market-snapshot";
import { GOLD_SYMBOL, type JewelryMarketData } from "./fetcher";

/**
 * Jewelry Market card (PRD §3.5): SAR/gram gold spot headline plus the
 * user's gram-weighted inventory re-priced at that spot. When the spot ages
 * out, values fall back to user-entered purchase prices with the
 * "unavailable" badge (PRD §3.5a rule 2).
 */
export function JewelryMarketCard({ data }: CardProps) {
  const market = data as JewelryMarketData | undefined;
  if (!market) return <CardDataFallback />;

  const targets: AlertTarget[] = [
    {
      key: GOLD_SYMBOL,
      label: "Gold spot (SAR/g)",
      assetClass: "jewelry",
      symbol: GOLD_SYMBOL,
      currency: market.spot?.currency ?? "SAR",
    },
  ];

  return (
    <div className="flex h-full flex-col gap-5">
      <SpotHeadline spot={market.spot} />
      <Inventory market={market} />
      <RecommendationList recommendations={market.recommendations} />
      <AlertRuleForm cardId="jewelry-market" targets={targets} />
    </div>
  );
}

function SpotHeadline({ spot }: { spot: JewelryMarketData["spot"] }) {
  const priced = usableReading(spot);
  const usdPerOunce = asNumber(priced?.payload?.usdPerOunce);
  const usdToSar = asNumber(priced?.payload?.usdToSar);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
          Gold spot
        </span>
        <FreshnessBadge reading={spot} />
      </div>
      {priced ? (
        <>
          <span className="text-headline-md text-on-surface">
            {formatMoney(priced.price, priced.currency, 2)}
            <span className="text-label-md text-on-surface-variant">
              {" "}
              / gram
            </span>
          </span>
          {usdPerOunce !== null && usdToSar !== null && (
            <span className="text-label-sm text-on-surface-variant">
              {formatMoney(usdPerOunce, "USD")} /oz × {usdToSar.toFixed(2)}{" "}
              USD→SAR
            </span>
          )}
        </>
      ) : spot === null ? (
        <span className="text-label-sm text-on-surface-variant">
          waiting for the first nightly gold refresh
        </span>
      ) : null}
    </div>
  );
}

function Inventory({ market }: { market: JewelryMarketData }) {
  if (market.pieces.length === 0) {
    return (
      <p className="text-label-sm text-on-surface-variant">
        No pieces yet. Add jewelry with gram weights in the Assets tab and the
        card re-prices them daily.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-label-md text-on-surface">
          Inventory · {market.totalGrams} g
        </span>
        <span className="text-body-md font-semibold text-on-surface">
          {market.totalMarketValueSar !== null
            ? formatMoney(market.totalMarketValueSar)
            : market.totalPurchaseValue > 0
              ? `${formatMoney(market.totalPurchaseValue)} (user-entered)`
              : "unpriced"}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-outline-variant">
        {market.pieces.map((piece) => (
          <li
            key={piece.assetId}
            className="flex items-center gap-3 py-2 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body-md text-on-surface">
                {piece.name}
              </span>
              <span className="text-label-sm text-on-surface-variant">
                {piece.grams} g · {piece.karat}k
              </span>
            </div>
            <span className="text-body-md text-on-surface">
              {piece.marketValueSar !== null
                ? formatMoney(piece.marketValueSar)
                : piece.purchasePrice !== null
                  ? formatMoney(piece.purchasePrice, piece.purchaseCurrency)
                  : "unpriced"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
