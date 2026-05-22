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
  | 'DECK_FULL'
  | null;

interface DeckState {
  deck: Deck;
  setDeck: (deck: Deck) => void;
  setDeckName: (name: string) => void;
  setHero: (group: CardGroup | null) => void;
  setFormat: (format: ApiFormat | null) => void;
  setApiId: (apiId: string) => void;
  addCard: (group: CardGroup) => void;
  removeCard: (slug: string) => void;
  decrementCard: (slug: string) => void;
  clearDeck: () => void;
  canAddCard: (group: CardGroup) => AddCardError;
  hasDeckViolations: () => boolean;
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

      setDeck: (deck) => set({ deck }),

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

        // Taille max du deck
        if (!isToken(group) && format?.maxCards != null) {
          const { playableCount } = deckStats();
          if (playableCount >= format.maxCards) return 'DECK_FULL';
        }

        // Faction (désactivée en sandbox)
        if (deck.hero && format?.code !== 'sandbox') {
          const heroFaction = getCardGroupFaction(deck.hero);
          if (heroFaction && getCardGroupFaction(group) !== heroFaction) return 'FACTION_MISMATCH';
        }

        const rarity = getRarityFromSlug(group.slug);

        if (rarity === 'UNIQUE') {
          // Chaque carte unique spécifique : max 1 exemplaire (par slug)
          if (deck.cards.some((dc) => dc.cardGroup.slug === group.slug)) return 'MAX_COPIES';

          // Variantes du même nom : limité par le format (ex. 3 Morgane différentes)
          const maxPerName = format?.limits.maxCopiesPerRarity ?? format?.limits.maxCopiesPerName ?? null;
          if (maxPerName != null) {
            const countSameName = deck.cards
              .filter((dc) => dc.cardGroup.name === group.name)
              .reduce((sum, dc) => sum + dc.quantity, 0);
            if (countSameName >= maxPerName) return 'MAX_COPIES';
          }
        } else {
          if (format?.limits.maxCopiesPerRarity != null) {
            // Limite par nom + rareté (ex: Singleton — 1 Commune + 1 Rare du même nom = OK)
            const countSameRarity = deck.cards
              .filter((dc) => dc.cardGroup.name === group.name && getRarityFromSlug(dc.cardGroup.slug) === rarity)
              .reduce((sum, dc) => sum + dc.quantity, 0);
            if (countSameRarity >= format.limits.maxCopiesPerRarity) return 'MAX_COPIES';
            // Vérifier aussi la limite totale par nom
            if (format.limits.maxCopiesPerName != null) {
              const countSameName = deck.cards
                .filter((dc) => dc.cardGroup.name === group.name)
                .reduce((sum, dc) => sum + dc.quantity, 0);
              if (countSameName >= format.limits.maxCopiesPerName) return 'MAX_COPIES';
            }
          } else {
            const maxCopies = format
              ? format.limits.maxCopiesPerName
              : (group.deckLimit ?? 3);
            if (maxCopies != null) {
              const countSameName = deck.cards
                .filter((dc) => dc.cardGroup.name === group.name)
                .reduce((sum, dc) => sum + dc.quantity, 0);
              if (countSameName >= maxCopies) return 'MAX_COPIES';
            }
          }
        }

        const { rareCount, uniqueCount, exaltedCount } = deckStats();

        if (format) {
          const { rare, exalted } = format.limits;
          const uniqueMax = getUniqueLimit(format, deck.hero?.name ?? null);
          if (rarity === 'RARE' && rare != null && rareCount >= rare) return 'MAX_RARE';
          if (rarity === 'UNIQUE' && uniqueMax != null && uniqueCount >= uniqueMax) return 'MAX_UNIQUE';
          if (rarity === 'EXALTED' && exalted != null && exaltedCount >= exalted) return 'MAX_EXALTED';
        }

        return null;
      },

      hasDeckViolations: () => {
        const { deck, deckStats } = get();

        const format = deck.format;

        // Cartes bannies / suspendues — sauf si le format l'autorise explicitement
        if (!format?.allowBanned) {
          if (deck.hero?.isBanned) return true;
          if (deck.cards.some((dc) => dc.cardGroup.isBanned)) return true;
        }
        if (!format?.allowSuspended) {
          if (deck.hero?.isSuspended) return true;
          if (deck.cards.some((dc) => dc.cardGroup.isSuspended)) return true;
        }
        if (!format) return false;

        const { rareCount, uniqueCount, exaltedCount } = deckStats();
        const uniqueMax = getUniqueLimit(format, deck.hero?.name ?? null);

        // Limites globales de rareté
        if (format.limits.rare != null && rareCount > format.limits.rare) return true;
        if (uniqueMax != null && uniqueCount > uniqueMax) return true;
        if (format.limits.exalted != null && exaltedCount > format.limits.exalted) return true;

        // Limites par carte
        for (const dc of deck.cards) {
          const rarity = getRarityFromSlug(dc.cardGroup.slug);
          if (rarity === 'UNIQUE') {
            const maxPerName = format.limits.maxCopiesPerRarity ?? format.limits.maxCopiesPerName ?? null;
            if (maxPerName != null) {
              const countSameName = deck.cards
                .filter((c) => c.cardGroup.name === dc.cardGroup.name)
                .reduce((sum, c) => sum + c.quantity, 0);
              if (countSameName > maxPerName) return true;
            }
          } else {
            if (format.limits.maxCopiesPerRarity != null) {
              // Limite par nom + rareté
              const cardRarity = getRarityFromSlug(dc.cardGroup.slug);
              const countSameRarity = deck.cards
                .filter((c) => c.cardGroup.name === dc.cardGroup.name && getRarityFromSlug(c.cardGroup.slug) === cardRarity)
                .reduce((sum, c) => sum + c.quantity, 0);
              if (countSameRarity > format.limits.maxCopiesPerRarity) return true;
              if (format.limits.maxCopiesPerName != null) {
                const countSameName = deck.cards
                  .filter((c) => c.cardGroup.name === dc.cardGroup.name)
                  .reduce((sum, c) => sum + c.quantity, 0);
                if (countSameName > format.limits.maxCopiesPerName) return true;
              }
            } else if (format.limits.maxCopiesPerName != null) {
              const countSameName = deck.cards
                .filter((c) => c.cardGroup.name === dc.cardGroup.name)
                .reduce((sum, c) => sum + c.quantity, 0);
              if (countSameName > format.limits.maxCopiesPerName) return true;
            }
          }
        }

        return false;
      },
    }),
    { name: 'altered-deck' }
  )
);
