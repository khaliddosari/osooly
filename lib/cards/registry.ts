import type { CardCategory, CardDefinition } from "./types";

/**
 * The card registry (PRD §3.5): adding a card is one folder under
 * `src/cards/<card-id>/` exporting a CardDefinition, plus one import line
 * here. The Customize sheet and the dashboard grid only ever see this list.
 *
 * The v1 catalogue lands in S5 — one line per card:
 *
 *   import { stockMarketCard } from "@/src/cards/stock-market";
 *   ...and add it to CARDS below.
 */
const CARDS: CardDefinition[] = [
  // S5: stock-market, real-estate-market, automobile-market, jewelry-market
];

const ORDERED_CATEGORIES: CardCategory[] = ["market", "portfolio", "tools"];

export function listCards(): CardDefinition[] {
  return CARDS;
}

export function getCard(id: string): CardDefinition | undefined {
  return CARDS.find((card) => card.id === id);
}

/** Registry grouped for the Customize sheet — only categories with cards. */
export function listCardsByCategory(): {
  category: CardCategory;
  cards: CardDefinition[];
}[] {
  return ORDERED_CATEGORIES.map((category) => ({
    category,
    cards: CARDS.filter((card) => card.category === category),
  })).filter((group) => group.cards.length > 0);
}
