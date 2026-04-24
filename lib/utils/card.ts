import type { CardGroup } from '@/lib/types/card';
import type { ApiDeckCard } from '@/lib/types/deck';

/**
 * Rareté depuis un slug (AX-001-C) ou une référence (ALT_EOLE_B_OR_109_U_374).
 * Codes : C = COMMON, R* = RARE, U = UNIQUE, E = EXALTED
 */
export function getRarityFromSlug(slugOrRef: string): string {
  const parts = slugOrRef.startsWith('ALT_') ? slugOrRef.split('_') : slugOrRef.split('-');
  const code = slugOrRef.startsWith('ALT_') ? (parts[5] ?? '') : (parts[2] ?? '');
  if (code === 'C') return 'COMMON';
  if (code.startsWith('R')) return 'RARE';
  if (code === 'U') return 'UNIQUE';
  if (code === 'E') return 'EXALTED';
  return 'COMMON';
}

/** Reconstruit un CardGroup minimal depuis un ApiDeckCard (structure plate) */
export function cardGroupFromDeckCard(dc: ApiDeckCard): CardGroup {
  return {
    id: 0,
    slug: dc.cardReference,
    name: dc.name ?? dc.cardReference,
    faction: { id: 0, code: dc.factionCode ?? '', name: dc.factionCode ?? '', position: 0 },
    cardType: { id: 0, reference: dc.cardTypeReference ?? '', name: dc.cardTypeReference ?? '' },
    cardSubTypes: [],
    mainCost: dc.mainCost,
    recallCost: dc.recallCost ?? null,
    deckLimit: 3,
    cards: [{ id: 0, reference: dc.cardReference, variation: 'standard', set: { reference: '' }, imagePath: dc.imagePath ?? null }],
    mainEffect: null,
    echoEffect: null,
    cardRulings: [],
    loreEntries: [],
  };
}

function getStandardCard(group: CardGroup) {
  return group.cards.find((c) => c.variation === 'standard') ?? group.cards[0];
}

export function getCardReference(group: CardGroup): string {
  return getStandardCard(group)?.reference ?? group.slug;
}

export function getCardGroupImage(group: CardGroup): string | null {
  if (!group.cards.length) return null;
  return getStandardCard(group)?.imagePath ?? null;
}

export function getCardGroupName(group: CardGroup): string {
  return group.name ?? '';
}

export function getCardGroupFaction(group: CardGroup): string {
  return group.faction?.code ?? '';
}
