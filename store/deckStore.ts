import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardGroup } from '@/lib/types/card';
import type { Deck, DeckCard, ApiFormat } from '@/lib/types/deck';
import { MIN_DECK_SIZE } from '@/lib/types/constants';
import { getRarityFromSlug, getCardGroupFaction } from '@/lib/utils/card';
import { getUniqueLimit } from '@/lib/utils/format';

export type AddCardError =
  | 'FACTION_MISMATCH'
  | 'MAX_COPIES'
  | 'MAX_RARE'
  | 'MAX_UNIQUE'
  | 'MAX_EXALTED'
  | null;

interface DeckState {
  deck: Deck;
  setDeckName: (name: string) => void;
  setHero: (group: CardGroup | null) => void;
  setFormat: (format: ApiFormat | null) => void;
  setApiId: (apiId: string) => void;
  addCard: (group: CardGroup) => void;
  removeCard: (slug: string) => void;
  decrementCard: (slug: string) => void;
  clearDeck: () => void;
  totalPlayableCards: () => number;
  canAddCard: (group: CardGroup) => AddCardError;
  deckFaction: () => string | null;
  deckStats: () => { rareCount: number; uniqueCount: number; exaltedCount: number; playableCount: number };
}

const TOKEN_TYPES = ['TOKEN', 'TOKEN_MANA'];

function isToken(group: CardGroup) {
  return TOKEN_TYPES.includes(group.cardType?.reference ?? '');
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createEmptyDeck(): Deck {
  return {
    id: generateId(),
    apiId: null,
    name: 'Nouveau deck',
    format: null,
    hero: null,
    cards: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => ({
      deck: createEmptyDeck(),

      setDeckName: (name) =>
        set((state) => ({ deck: { ...state.deck, name, updatedAt: new Date().toISOString() } })),

      setFormat: (format) =>
        set((state) => ({ deck: { ...state.deck, format, updatedAt: new Date().toISOString() } })),

      setApiId: (apiId) =>
        set((state) => ({ deck: { ...state.deck, apiId } })),

      setHero: (group) => {

        set((state) => ({
          deck: {
            ...state.deck,
            hero: group,
            // Purge les cartes hors faction si on change de héros
            cards: group
              ? state.deck.cards.filter(
                  (dc) => getCardGroupFaction(dc.cardGroup) === getCardGroupFaction(group)
                )
              : state.deck.cards,
            updatedAt: new Date().toISOString(),
          },
        }));
      },

      addCard: (group) => {
        const { canAddCard, deck } = get();
        const error = canAddCard(group);

        if (error !== null) return;

        const existingIndex = deck.cards.findIndex((dc) => dc.cardGroup.slug === group.slug);
        const newCards: DeckCard[] =
          existingIndex >= 0
            ? deck.cards.map((dc, i) =>
                i === existingIndex ? { ...dc, quantity: dc.quantity + 1 } : dc
              )
            : [...deck.cards, { cardGroup: group, quantity: 1 }];

        set((state) => ({
          deck: { ...state.deck, cards: newCards, updatedAt: new Date().toISOString() },
        }));
      },

      decrementCard: (slug) => {
        const { deck } = get();
        const idx = deck.cards.findIndex((dc) => dc.cardGroup.slug === slug);
        if (idx < 0) return;
        const current = deck.cards[idx];
        const newCards =
          current.quantity <= 1
            ? deck.cards.filter((_, i) => i !== idx)
            : deck.cards.map((dc, i) => (i === idx ? { ...dc, quantity: dc.quantity - 1 } : dc));

        set((state) => ({
          deck: { ...state.deck, cards: newCards, updatedAt: new Date().toISOString() },
        }));
      },

      removeCard: (slug) =>
        set((state) => ({
          deck: {
            ...state.deck,
            cards: state.deck.cards.filter((dc) => dc.cardGroup.slug !== slug),
            updatedAt: new Date().toISOString(),
          },
        })),

      clearDeck: () => set({ deck: createEmptyDeck() }),

      totalPlayableCards: () => {
        const { deck } = get();
        return deck.cards
          .filter((dc) => !isToken(dc.cardGroup))
          .reduce((sum, dc) => sum + dc.quantity, 0);
      },

      deckFaction: () => {
        const { deck } = get();
        return deck.hero ? getCardGroupFaction(deck.hero) : null;
      },

      deckStats: () => {
        const { deck } = get();
        let rareCount = 0;
        let uniqueCount = 0;
        let exaltedCount = 0;
        let playableCount = 0;
        for (const dc of deck.cards) {
          if (!isToken(dc.cardGroup)) playableCount += dc.quantity;
          const rarity = getRarityFromSlug(dc.cardGroup.slug);
          if (rarity === 'RARE') rareCount += dc.quantity;
          if (rarity === 'UNIQUE') uniqueCount += dc.quantity;
          if (rarity === 'EXALTED') exaltedCount += dc.quantity;
        }
        return { rareCount, uniqueCount, exaltedCount, playableCount };
      },

      canAddCard: (group) => {
        const { deck, deckStats } = get();
        const format = deck.format;

        if (group.cardType?.reference === 'HERO') return null;

        // Faction
        if (deck.hero) {
          const heroFaction = getCardGroupFaction(deck.hero);
          if (heroFaction && getCardGroupFaction(group) !== heroFaction) return 'FACTION_MISMATCH';
        }

        // Max copies par nom (rare et common du même nom = même limite)
        const maxCopies = format?.limits.maxCopiesPerRarity ?? format?.limits.maxCopiesPerName ?? group.deckLimit ?? 3;
        const groupName = group.name;
        const existing = deck.cards.find((dc) => dc.cardGroup.name === groupName);
        if (existing && existing.quantity >= maxCopies) return 'MAX_COPIES';

        const { rareCount, uniqueCount, exaltedCount } = deckStats();
        const rarity = getRarityFromSlug(group.slug);

        if (format) {
          const { rare, exalted } = format.limits;
          const uniqueMax = getUniqueLimit(format, deck.hero?.name ?? null);
          if (rarity === 'RARE' && rare != null && rareCount >= rare) return 'MAX_RARE';
          if (rarity === 'UNIQUE' && uniqueMax != null && uniqueCount >= uniqueMax) return 'MAX_UNIQUE';
          if (rarity === 'EXALTED' && exalted != null && exaltedCount >= exalted) return 'MAX_EXALTED';
        }

        return null;
      },
    }),
    { name: 'altered-deck' }
  )
);
