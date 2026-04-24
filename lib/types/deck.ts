import type { CardGroup } from './card';

export interface ApiFormatLimits {
  unique: number | null;
  rare: number | null;
  exalted: number | null;
  maxCopiesPerName: number | null;
  maxCopiesPerRarity: number | null;
}

export interface ApiFormat {
  code: string;
  label: string;
  minCards: number;
  maxCards: number;
  limits: ApiFormatLimits;
  uniqueLimitsByHero?: Record<string, string[]> | null;
}

export interface SaveDeckPayload {
  name: string;
  description?: string | null;
  format?: string | null;
  isPublic?: boolean;
  deckCards: { cardReference: string; quantity: number }[];
}

export interface ApiDeck {
  id: string;
  name: string;
  description: string | null;
  format: string | null;
  isPublic: boolean;
  stats: {
    totalCards: number;
    byRarity: Record<string, number>;
    hero: { imagePath: string | null; name: string; reference: string } | null;
  } | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ApiDeckCard {
  cardReference: string;
  quantity: number;
  name: string | null;
  factionCode: string | null;
  cardTypeReference: string | null;
  mainCost: number | null;
  recallCost?: number | null;
  setReference?: string | null;
  imagePath: string | null;
}

export interface ApiDeckDetail extends ApiDeck {
  cards: ApiDeckCard[];
}

export interface DeckCard {
  cardGroup: CardGroup;
  quantity: number;
}

export interface Deck {
  id: string;
  apiId: string | null;
  name: string;
  format: ApiFormat | null;
  hero: CardGroup | null;
  cards: DeckCard[];
  createdAt: string;
  updatedAt: string;
}
