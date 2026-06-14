"use client";

import { AlertRuleForm, type AlertTarget } from "@/components/alert-rule-form";
import { CardDataFallback, FreshnessBadge } from "@/components/card-status";
import { RecommendationList } from "@/components/recommendation-list";
import type { CardProps } from "@/lib/cards/types";
import { formatMoney } from "@/lib/format";
import { usableReading } from "@/lib/market-snapshot";
import type {
  CityMarket,
  PropertySummary,
  RealEstateMarketData,
} from "./fetcher";

/**
 * Real Estate Market card (PRD §3.5): the official REGA transaction index
 * plus Aqar live asking medians per city, alongside the user's properties at
 * their user-entered values. Source outages degrade to badges, never errors
 * (PRD §3.5a rule 2).
 */
export function RealEstateMarketCard({ data }: CardProps) {
  const market = data as RealEstateMarketData | undefined;
  if (!market) return <CardDataFallback />;

  return (
    <div className="flex h-full flex-col gap-5">
      <CityTrends cities={market.cities} />
      <Properties properties={market.properties} />
      <RecommendationList recommendations={market.recommendations} />
      <AlertRuleForm cardId="real-estate-market" targets={alertTargets(market)} />
    </div>
  );
}

/** Watch the official REGA transaction index of each tracked city. */
function alertTargets(market: RealEstateMarketData): AlertTarget[] {
  return market.cities.flatMap((cityMarket) =>
    cityMarket.index
      ? [
          {
            key: cityMarket.slug,
            label: cityMarket.city,
            assetClass: "real_estate" as const,
            symbol: cityMarket.index.symbol,
            currency: cityMarket.index.currency,
          },
        ]
      : []
  );
}

function CityTrends({ cities }: { cities: CityMarket[] }) {
  if (cities.length === 0) {
    return (
      <p className="text-label-sm text-on-surface-variant">
        Waiting for the first nightly REGA and Aqar refresh.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
        City trends
      </span>
      <ul className="flex flex-col divide-y divide-outline-variant">
        {cities.map((cityMarket) => (
          <CityRow key={cityMarket.slug} market={cityMarket} />
        ))}
      </ul>
    </div>
  );
}

function CityRow({ market }: { market: CityMarket }) {
  const index = usableReading(market.index);
  const asking = usableReading(market.comparables);
  const badgeSource =
    index ?? asking ?? market.index ?? market.comparables ?? null;

  return (
    <li className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <span className="truncate text-body-md text-on-surface">
        {market.city}
      </span>
      <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-label-sm text-on-surface-variant">
        {index && (
          <span className="whitespace-nowrap">
            REGA index {index.price.toLocaleString("en-US")}
          </span>
        )}
        {asking && (
          <span className="whitespace-nowrap">
            asking median {formatMoney(asking.price)}
          </span>
        )}
        {!index && !asking && !badgeSource && <span>no market data yet</span>}
        <FreshnessBadge reading={badgeSource} />
      </span>
    </li>
  );
}

function Properties({ properties }: { properties: PropertySummary[] }) {
  if (properties.length === 0) {
    return (
      <p className="text-label-sm text-on-surface-variant">
        No properties yet. Add them in the Assets tab to track
        neighborhood-level shifts where you own.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">
        Your properties
      </span>
      <ul className="flex flex-col divide-y divide-outline-variant">
        {properties.map((property) => (
          <li
            key={property.assetId}
            className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-body-md text-on-surface">
                {property.name}
              </span>
              {property.city && (
                <span className="text-label-sm text-on-surface-variant">
                  {property.city}
                </span>
              )}
            </div>
            {property.purchasePrice !== null && (
              <span className="whitespace-nowrap text-body-md font-semibold text-on-surface">
                {formatMoney(property.purchasePrice, property.purchaseCurrency)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
