'use client';

import type { DeckCard } from '@/lib/types/deck';
import { FACTION_BADGE_COLORS } from '@/lib/types/constants';
import { getCardGroupName, getCardGroupFaction, getRarityFromSlug } from '@/lib/utils/card';
import { useDeckStore } from '@/store/deckStore';

interface DeckCardItemProps {
  deckCard: DeckCard;
}

export default function DeckCardItem({ deckCard }: DeckCardItemProps) {
  const { addCard, decrementCard, removeCard, canAddCard } = useDeckStore();
  const { cardGroup, quantity } = deckCard;

  const name = getCardGroupName(cardGroup);
  const factionCode = getCardGroupFaction(cardGroup);
  const factionBadge = factionCode ? (FACTION_BADGE_COLORS[factionCode] ?? 'bg-gray-600') : 'bg-gray-700';
  const rarity = getRarityFromSlug(cardGroup.slug);
const addable = canAddCard(cardGroup) === null;

  const rarityStyle =
    rarity === 'RARE'
      ? { backgroundColor: 'rgba(37, 99, 235, 0.25)', borderColor: 'rgba(59, 130, 246, 0.5)' }
      : rarity === 'UNIQUE'
      ? { backgroundColor: 'rgba(202, 138, 4, 0.25)', borderColor: 'rgba(234, 179, 8, 0.5)' }
      : {};

  return (
    <div style={rarityStyle} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-c-elevated border border-c-border group">
      {factionCode && (
        <span className={`text-[9px] font-bold px-1 rounded text-white shrink-0 ${factionBadge}`}>
          {factionCode}
        </span>
      )}

      {(cardGroup.mainCost != null || cardGroup.recallCost != null) && (
        <span className="text-xs font-mono bg-c-input text-c-text rounded px-1 min-w-[18px] text-center shrink-0">
          {cardGroup.mainCost ?? '—'}{cardGroup.recallCost != null ? `/${cardGroup.recallCost}` : ''}
        </span>
      )}

      <span className="flex-1 text-xs text-c-text-secondary truncate">{name}</span>

      <span className="text-[9px] text-c-text-subtle shrink-0">
        {rarity.charAt(0)}
      </span>

      {/* Controls + quantity (même zone, swap par opacity) */}
      <div className="relative shrink-0 w-16 flex justify-end">
        <span className="text-xs text-c-text-muted text-right transition-opacity group-hover:opacity-0">
          ×{quantity}
        </span>
        <div className="absolute inset-0 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => decrementCard(cardGroup.slug)}
            className="w-4 h-4 flex items-center justify-center text-c-text-muted hover:text-red-400 text-xs"
          >
            −
          </button>
          <span className="text-xs text-c-text font-bold w-3 text-center">{quantity}</span>
          <button
            onClick={() => addCard(cardGroup)}
            disabled={!addable}
            className="w-4 h-4 flex items-center justify-center text-c-text-muted hover:text-green-400 text-xs disabled:opacity-30"
          >
            +
          </button>
          <button
            onClick={() => removeCard(cardGroup.slug)}
            className="w-4 h-4 flex items-center justify-center text-c-text-subtle hover:text-red-400 text-xs"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
