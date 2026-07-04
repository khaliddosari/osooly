import type { Metadata } from "next";
import { AssetTable } from "@/components/asset-table";
import { listAssetsForUser } from "@/lib/assets/store";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const metadata: Metadata = {
  title: "Assets - Osooly",
};

/**
 * The /assets flat ledger (PRD 3.4): search / filter / edit / add raw holdings
 * independent of the dashboard cards. The signed-in user's holdings are read
 * server-side and handed to the client table as its seed; edits round-trip
 * through /api/assets.
 */
export default async function AssetsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const assets = userId ? await listAssetsForUser(await getDb(), userId) : [];

  return <AssetTable initialAssets={assets} canUse={Boolean(userId)} />;
}
