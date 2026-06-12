"use client";

import { CardDataFallback, FreshnessBadge } from "@/components/card-status";
import { Icon } from "@/components/icon";
import { RecommendationList } from "@/components/recommendation-list";
import type { CardProps } from "@/lib/cards/types";
import { asNumber, formatMoney, formatSignedPercent } from "@/lib/format";
import { usableReading } from "@/lib/market-snapshot";
import { cn } from "@/lib/utils";
import type { StockHolding, StockMarketData } from "./fetcher";

/**
 * Stock Market card (PRD §3.5): TASI headline plus the user's holdings
 * priced at the latest cached quotes. A degraded feed shows the last-known
 * price with a freshness badge, never an error state (PRD §3.5a rule 2).
 */
export function StockMarketCard({ data }: CardProps) {
  const market = data as StockMarketData | undefined;
  if (!market) return <CardDataFallback />;

  return (
    <div className="flex h-full flex-col gap-5">
      <IndexHeadline index={market.index} />
      <HoldingsList holdings={market.holdings} />
      <RecommendationList recommendations={market.recommendations} />
    </div>
  );
}

function IndexHeadline({ index }: { index: StockMarketData["index"] }) {
  const priced = usableReading(index);
  if (!priced) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
          TASI
        </span>
        {index ? (
          <FreshnessBadge reading={index} />
        ) : (
          <span className="text-label-sm text-on-surface-variant">
            waiting for the first refresh; quotes update every minute during
            market hours
          </span>
        )}
      </div>
    );
  }

  const pct = asNumber(priced.payload?.percentChange);
  const up = (pct ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
          TASI
        </span>
        <FreshnessBadge reading={priced} />
      </div>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-headline-md text-on-surface">
          {formatMoney(priced.price, priced.currency)}
        </span>
        {pct !== null && (
          <span
            className={cn(
              "flex items-center gap-1.5 text-label-md",
              up ? "text-success-green" : "text-error"
            )}
          >
            <Icon
              name={up ? "trending_up" : "trending_down"}
              style={{ fontSize: 12 }}
            />
            {formatSignedPercent(pct)}
          </span>
        )}
      </div>
    </div>
  );
}

function HoldingsList({ holdings }: { holdings: StockHolding[] }) {
  if (holdings.length === 0) {
    return (
      <p className="text-label-sm text-on-surface-variant">
        No holdings tracked yet. Add stock positions in the Assets tab and
        they reprice here on every refresh.
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y divide-outline-variant">
      {holdings.map((holding) => (
        <HoldingRow key={holding.assetId} holding={holding} />
      ))}
    </ul>
  );
}

function HoldingRow({ holding }: { holding: StockHolding }) {
  const quote = usableReading(holding.snapshot);
  const pct = quote ? asNumber(quote.payload?.percentChange) : null;

  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-md text-on-surface">
          {holding.symbol ?? holding.name}
        </span>
        <span className="truncate text-label-sm text-on-surface-variant">
          {quote
            ? `${holding.quantity} × ${formatMoney(quote.price, quote.currency, 2)}`
            : holding.name}
        </span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        {quote ? (
          <>
            <span className="text-body-md font-semibold text-on-surface">
              {formatMoney(quote.price * holding.quantity, quote.currency)}
            </span>
            {pct !== null && (
              <span
                className={cn(
                  "text-label-sm",
                  pct >= 0 ? "text-success-green" : "text-error"
                )}
              >
                {formatSignedPercent(pct)}
              </span>
            )}
            <FreshnessBadge reading={quote} />
          </>
        ) : holding.purchasePrice !== null ? (
          <>
            <span className="text-body-md font-semibold text-on-surface">
              {formatMoney(
                holding.purchasePrice * holding.quantity,
                holding.purchaseCurrency
              )}
            </span>
            <span className="text-label-sm text-on-surface-variant">
              user-entered
            </span>
          </>
        ) : (
          <span className="text-label-sm text-on-surface-variant">
            awaiting quote
          </span>
        )}
      </div>
    </li>
  );
}
