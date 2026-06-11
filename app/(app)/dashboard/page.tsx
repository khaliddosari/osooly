import type { Metadata } from "next";
import { EmptyStateCard } from "@/components/empty-state-card";

export const metadata: Metadata = {
  title: "Dashboard — Osooly",
};

/**
 * S1: the dashboard renders the empty-state placeholder only. The card grid,
 * page pills, and layout persistence arrive with the card system (S3).
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-section-gap">
      <EmptyStateCard />
    </div>
  );
}
