import type { Metadata } from "next";
import { DashboardGrid } from "@/components/dashboard-grid";
import { EmptyStateCard } from "@/components/empty-state-card";
import { auth } from "@/lib/auth";
import { loadCardOrder } from "@/lib/cards/layout-store";

export const metadata: Metadata = {
  title: "Dashboard — Osooly",
};

/**
 * The paginated card grid (PRD §3.5). Signed-in users get their persisted
 * layout from D1; a fresh (or signed-out) dashboard shows exactly one
 * placeholder card (PRD §3.4 empty-state rule).
 */
export default async function DashboardPage() {
  const session = await auth();
  const order = session?.user?.id ? await loadCardOrder(session.user.id) : [];

  if (order.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-gutter py-section-gap">
        <EmptyStateCard />
      </div>
    );
  }

  return <DashboardGrid initialOrder={order} />;
}
