/**
 * The seam that lets a card's no-arg `fetcher()` (PRD §3.5 contract) reach
 * D1 and the session without dragging server-only modules into the client
 * bundle: the registry (and therefore every card module) is imported by
 * client components, so card code can only ever import *this* universal
 * module. Server code (lib/cards/resolve-data.ts) injects the real provider
 * before any fetcher runs; in the browser the provider is never set and a
 * stray call fails loudly instead of fetching.
 */

export interface CardServerContext {
  db: D1Database;
  /** Signed-in user id, or null (cards then show market data only). */
  userId: string | null;
}

type ContextProvider = () => Promise<CardServerContext>;

let provider: ContextProvider | null = null;

/** Called once (module scope) by lib/cards/resolve-data.ts. */
export function provideCardServerContext(next: ContextProvider): void {
  provider = next;
}

export async function cardServerContext(): Promise<CardServerContext> {
  if (!provider) {
    throw new Error(
      "Card fetchers only run on the server; no CardServerContext provider is registered in this runtime."
    );
  }
  return provider();
}
