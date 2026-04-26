export interface CardGroupFaction {
  id: number;
  name: string;
  code: string;
  position: number;
}

export interface CardGroupType {
  id: number;
  reference: string;
  name: string;
}

export interface CardGroupVariant {
  id: number;
  reference: string;
  variation: string;
  set: { reference: string };
  imagePath: string | null;
}

export interface CardGroup {
  id: number;
  slug: string;
  faction: CardGroupFaction;
  cardType: CardGroupType;
  cardSubTypes: string[];
  mainCost: number | null;
  recallCost: number | null;
  oceanPower?: number | null;
  mountainPower?: number | null;
  forestPower?: number | null;
  permanent?: string;
  deckLimit: number;
  cards: CardGroupVariant[];
  name: string;
  mainEffect: string | null;
  echoEffect: string | string[] | null;
  cardRulings: { question: string; answer: string; eventFormat: string | null; rulingDate: string | null }[];
  loreEntries: { type: string; elements: { type: string; text: string }[] }[];
}

export interface CardGroupFilters {
  name?: string;
  faction?: string;
  cardType?: string;
  rarity?: string | string[];
  mainCost?: string;
  recallCost?: string;
  oceanPower?: string;
  mountainPower?: string;
  forestPower?: string;
  'order[set.date]'?: 'asc' | 'desc';
  'set.reference'?: string;
  promo?: string;
  page?: number;
  itemsPerPage?: number;
}

export interface ApiSet {
  id: number;
  alteredId: string;
  name: string;
  name_en: string | null;
  reference: string;
  illustration: string | null;
  illustrationPath: string | null;
  date: string | null;
}

export interface ApiFaction {
  id: number;
  code: string;
  name: string;
  position: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    totalItems: number;
    itemsPerPage: number;
    currentPage: number;
    lastPage: number;
  };
}
