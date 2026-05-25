import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CardGroup } from '@/lib/types/card';
import { getCardGroupFaction } from '@/lib/utils/card';

export const SEALED_MIN_DECK_SIZE = 30;
export const SEALED_MAX_FACTIONS = 3;
const TOKEN_TYPES = ['TOKEN', 'TOKEN_MANA'];

export type SealedAddError = 'NOT_IN_POOL' | 'MAX_COPIES' | 'TOO_MANY_FACTIONS' | null;

export interface SealedDeckCard {
  cardGroup: CardGroup;
  quantity: number;
}

export interface SealedPack {
  id: number;
  hero: CardGroup | null;
  commons: CardGroup[];
  rares: CardGroup[];
  hasUniqueSlot: boolean;
}

interface SealedDeck {
  hero: CardGroup | null;
  cards: SealedDeckCard[];
  name: string;
}

interface SealedState {
  packs: SealedPack[];
  pool: SealedDeckCard[];
  heroPool: CardGroup[];
  deck: SealedDeck;
  selectedSet: string | null;
  uniqueDrawsAvailable: number;
  uniqueDrawsUsed: number;

  setPool: (pool: SealedDeckCard[], packs: SealedPack[], heroPool: CardGroup[], uniqueDrawsAvailable: number) => void;
  addToPool: (card: CardGroup) => void;
  setSelectedSet: (ref: string | null) => void;
  clearPool: () => void;
  setHero: (hero: CardGroup | null) => void;
  addCard: (group: CardGroup) => void;
  decrementCard: (slug: string) => void;
  removeCard: (slug: string) => void;
  clearDeck: () => void;
  setDeckName: (name: string) => void;
  canAddCard: (group: CardGroup) => SealedAddError;
  deckFactions: () => string[];
  playableCount: () => number;
  isValid: () => boolean;
}

function isToken(group: CardGroup) {
  return TOKEN_TYPES.includes(group.cardType?.reference ?? '');
}

function createEmptyDeck(): SealedDeck {
  return { hero: null, cards: [], name: 'Deck Scellé' };
}

export const useSealedStore = create<SealedState>()(
  persist(
    (set, get) => ({
      packs: [],
      pool: [],
      heroPool: [],
      deck: createEmptyDeck(),
      selectedSet: null,
      uniqueDrawsAvailable: 0,
      uniqueDrawsUsed: 0,

      setPool: (pool, packs, heroPool, uniqueDrawsAvailable) =>
        set({ pool, packs, heroPool, uniqueDrawsAvailable, uniqueDrawsUsed: 0 }),

      addToPool: (card) =>
        set((s) => {
          const existing = s.pool.find((p) => p.cardGroup.slug === card.slug);
          const pool = existing
            ? s.pool.map((p) => p.cardGroup.slug === card.slug ? { ...p, quantity: p.quantity + 1 } : p)
            : [...s.pool, { cardGroup: card, quantity: 1 }];
          return { pool, uniqueDrawsUsed: s.uniqueDrawsUsed + 1 };
        }),

      setSelectedSet: (ref) => set({ selectedSet: ref }),

      clearPool: () =>
        set({ packs: [], pool: [], heroPool: [], deck: createEmptyDeck(), uniqueDrawsAvailable: 0, uniqueDrawsUsed: 0 }),

      setHero: (hero) => set((s) => ({ deck: { ...s.deck, hero } })),
      setDeckName: (name) => set((s) => ({ deck: { ...s.deck, name } })),

      addCard: (group) => {
        const { canAddCard, deck } = get();
        if (canAddCard(group) !== null) return;
        const idx = deck.cards.findIndex((dc) => dc.cardGroup.slug === group.slug);
        const newCards =
          idx >= 0
            ? deck.cards.map((dc, i) => (i === idx ? { ...dc, quantity: dc.quantity + 1 } : dc))
            : [...deck.cards, { cardGroup: group, quantity: 1 }];
        set((s) => ({ deck: { ...s.deck, cards: newCards } }));
      },

      decrementCard: (slug) => {
        const { deck } = get();
        const idx = deck.cards.findIndex((dc) => dc.cardGroup.slug === slug);
        if (idx < 0) return;
        const c = deck.cards[idx];
        const newCards =
          c.quantity <= 1
            ? deck.cards.filter((_, i) => i !== idx)
            : deck.cards.map((dc, i) => (i === idx ? { ...dc, quantity: dc.quantity - 1 } : dc));
        set((s) => ({ deck: { ...s.deck, cards: newCards } }));
      },

      removeCard: (slug) =>
        set((s) => ({
          deck: { ...s.deck, cards: s.deck.cards.filter((dc) => dc.cardGroup.slug !== slug) },
        })),

      clearDeck: () => set(() => ({ deck: createEmptyDeck() })),

      canAddCard: (group) => {
        const { pool, deck, deckFactions } = get();
        if (group.cardType?.reference === 'HERO') return null;
        const inPool = pool.find((p) => p.cardGroup.slug === group.slug);
        if (!inPool) return 'NOT_IN_POOL';
        const deckQty = deck.cards.find((dc) => dc.cardGroup.slug === group.slug)?.quantity ?? 0;
        if (deckQty >= inPool.quantity) return 'MAX_COPIES';
        if (!isToken(group)) {
          const faction = getCardGroupFaction(group);
          const factions = deckFactions();
          if (faction && !factions.includes(faction) && factions.length >= SEALED_MAX_FACTIONS) {
            return 'TOO_MANY_FACTIONS';
          }
        }
        return null;
      },

      deckFactions: () => {
        const factions = new Set<string>();
        for (const dc of get().deck.cards) {
          if (!isToken(dc.cardGroup)) {
            const f = getCardGroupFaction(dc.cardGroup);
            if (f) factions.add(f);
          }
        }
        return Array.from(factions);
      },

      playableCount: () => {
        const { deck } = get();
        let count = deck.hero ? 1 : 0;
        for (const dc of deck.cards) {
          if (!isToken(dc.cardGroup)) count += dc.quantity;
        }
        return count;
      },

      isValid: () => {
        const { deck, deckFactions, playableCount } = get();
        if (playableCount() < SEALED_MIN_DECK_SIZE) return false;
        const factions = deckFactions();
        if (factions.length > SEALED_MAX_FACTIONS) return false;
        if (deck.hero) {
          const hf = getCardGroupFaction(deck.hero);
          if (hf && factions.length > 0 && !factions.includes(hf)) return false;
        }
        return true;
      },
    }),
    { name: 'altered-sealed' }
  )
);
