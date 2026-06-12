import "server-only";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getCard } from "./registry";
import { provideCardServerContext } from "./server-context";

/**
 * Server-side resolution of card data: the dashboard page calls
 * resolveCardData() with the user's installed cards and passes the result
 * into the (client) grid as plain props. Importing this module wires the
 * CardServerContext provider that the cards' fetchers read through.
 *
 * v1 resolves every installed card in one pass; with the four-card catalogue
 * that is a handful of D1 reads. Per-page lazy fetching (PRD §3.9) becomes
 * worth it once the catalogue outgrows a single page's worth of queries.
 */
provideCardServerContext(async () => {
  const [db, session] = await Promise.all([getDb(), auth()]);
  return { db, userId: session?.user?.id ?? null };
});

export async function resolveCardData(
  cardIds: string[]
): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    cardIds.map(async (id) => {
      const fetcher = getCard(id)?.fetcher;
      if (!fetcher) return [id, undefined] as const;
      try {
        return [id, await fetcher()] as const;
      } catch (error) {
        // A failed fetcher degrades to the card's own fallback UI; it never
        // takes the dashboard down (PRD §3.5a rule 2).
        console.error(`[cards] ${id} fetcher failed:`, error);
        return [id, undefined] as const;
      }
    })
  );
  return Object.fromEntries(entries.filter(([, data]) => data !== undefined));
}
