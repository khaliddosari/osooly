"use client";

import { CardDataFallback, FreshnessBadge } from "@/components/card-status";
import { Icon } from "@/components/icon";
import { RecommendationList } from "@/components/recommendation-list";
import type { CardProps } from "@/lib/cards/types";
import { asNumber, formatMoney, formatSignedPercent } from "@/lib/format";
import { usableReading, type SnapshotReading } from "@/lib/market-snapshot";
import { cn } from "@/lib/utils";
import type { AutoMarketData, VehicleValuation } from "./fetcher";

/**
 * Automobile Market card (PRD §3.5): each saved vehicle priced against the
 * nightly Syarah (dealer) and Haraj (private) medians, with drift vs. the
 * purchase price. Scrape outages fall back to the user-entered value
 * (PRD §3.5a rules 2-3).
 */
export function AutomobileMarketCard({ data }: CardProps) {
  const market = data as AutoMarketData | undefined;
  if (!market) return <CardDataFallback />;

  if (market.vehicles.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Icon
          name="directions_car"
          className="text-on-surface-variant"
          style={{ fontSize: 20 }}
        />
        <p className="max-w-xs text-body-md text-on-surface-variant">
          Save a vehicle (make and model) in the Assets tab; nightly Syarah
          and Haraj scans price it here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <ul className="flex flex-col divide-y divide-outline-variant">
        {market.vehicles.map((vehicle) => (
          <VehicleRow key={vehicle.assetId} vehicle={vehicle} />
        ))}
      </ul>
      <RecommendationList recommendations={market.recommendations} />
    </div>
  );
}

function VehicleRow({ vehicle }: { vehicle: VehicleValuation }) {
  const title =
    vehicle.make && vehicle.model
      ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")
      : vehicle.name;
  const drift =
    vehicle.estimateSar !== null && vehicle.purchasePrice
      ? ((vehicle.estimateSar - vehicle.purchasePrice) /
          vehicle.purchasePrice) *
        100
      : null;
  const fallbackReading = vehicle.dealer ?? vehicle.privateMarket;

  return (
    <li className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-body-md text-on-surface">{title}</span>
        {vehicle.estimateSar !== null ? (
          <span className="whitespace-nowrap text-body-md font-semibold text-on-surface">
            {formatMoney(vehicle.estimateSar)}
          </span>
        ) : vehicle.purchasePrice !== null ? (
          <span className="whitespace-nowrap text-body-md font-semibold text-on-surface">
            {formatMoney(vehicle.purchasePrice, vehicle.purchaseCurrency)}
          </span>
        ) : (
          <span className="whitespace-nowrap text-label-sm text-on-surface-variant">
            awaiting first scan
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SourceQuote label="dealer" reading={vehicle.dealer} />
        <SourceQuote label="private" reading={vehicle.privateMarket} />
        {drift !== null && (
          <span
            className={cn(
              "flex items-center gap-1 text-label-sm",
              drift >= 0 ? "text-success-green" : "text-error"
            )}
          >
            <Icon
              name={drift >= 0 ? "trending_up" : "trending_down"}
              style={{ fontSize: 10 }}
            />
            {formatSignedPercent(drift)} vs purchase
          </span>
        )}
        {vehicle.estimateSar === null && (
          <>
            {vehicle.purchasePrice !== null && (
              <span className="text-label-sm text-on-surface-variant">
                user-entered
              </span>
            )}
            <FreshnessBadge reading={fallbackReading} />
          </>
        )}
      </div>
    </li>
  );
}

function SourceQuote({
  label,
  reading,
}: {
  label: string;
  reading: SnapshotReading | null;
}) {
  const priced = usableReading(reading);
  if (!priced) return null;
  const samples = asNumber(priced.payload?.sampleCount);

  return (
    <span className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
      {label} {formatMoney(priced.price)}
      {samples !== null && ` · ${samples} listings`}
      <FreshnessBadge reading={priced} />
    </span>
  );
}
