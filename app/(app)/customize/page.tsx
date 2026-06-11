import type { Metadata } from "next";
import { CustomizeSheet } from "@/components/customize-sheet";
import { auth } from "@/lib/auth";
import { loadCardOrder } from "@/lib/cards/layout-store";

export const metadata: Metadata = {
  title: "Customize — Osooly",
};

/** The card registry, grouped by category, with add/remove (PRD §3.4). */
export default async function CustomizePage() {
  const session = await auth();
  const userId = session?.user?.id;
  const installed = userId ? await loadCardOrder(userId) : [];

  return (
    <div className="flex flex-1 justify-center px-gutter py-12">
      <CustomizeSheet installedCardIds={installed} canEdit={Boolean(userId)} />
    </div>
  );
}
