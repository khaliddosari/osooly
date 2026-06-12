import { automobileMarketCard } from "@/src/cards/automobile-market";
import { jewelryMarketCard } from "@/src/cards/jewelry-market";
import { realEstateMarketCard } from "@/src/cards/real-estate-market";
import { stockMarketCard } from "@/src/cards/stock-market";
import type { CardCategory, CardDefinition } from "./types";

/**
 * The card registry (PRD §3.5): adding a card is one folder under
 * `src/cards/<card-id>/` exporting a CardDefinition, plus one import line
 * here. The Customize sheet and the dashboard grid only ever see this list.
 *
 * Order matters twice: it is the Customize sheet's listing order within a
 * category, and the PRD §3.5 catalogue order is kept here for the v1 four.
 */
const CARDS: CardDefinition[] = [
  stockMarketCard,
  realEstateMarketCard,
  automobileMarketCard,
  jewelryMarketCard,
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
