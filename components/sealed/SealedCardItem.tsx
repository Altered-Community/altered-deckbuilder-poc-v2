'use client';

import Image from 'next/image';
import { useLocale } from 'next-intl';
import type { CardGroup } from '@/lib/types/card';
import { FACTION_BADGE_COLORS } from '@/lib/types/constants';
import { getCardGroupName, getCardGroupImage, getCardGroupFaction, getRarityFromSlug, getCardReference } from '@/lib/utils/card';
import UniqueCardRenderer from '@/components/cards/UniqueCardRenderer';
import { useSealedStore } from '@/store/sealedStore';

const RARITY_BORDER: Record<string, string> = {
  COMMON: 'border-gray-500',
  RARE: 'border-blue-400',
  UNIQUE: 'border-purple-400',
  EXALTED: 'border-yellow-400',
};

interface Props {
  card: CardGroup;
  poolQty: number;
  onZoom?: () => void;
}

export default function SealedCardItem({ card, poolQty, onZoom }: Props) {
  const locale = useLocale();
  const { addCard, deck, canAddCard } = useSealedStore();

  const name = getCardGroupName(card);
  const image = getCardGroupImage(card, locale);
  const factionCode = getCardGroupFaction(card);
  const rarity = getRarityFromSlug(card.slug);
  const rarityBorder = RARITY_BORDER[rarity] ?? 'border-gray-600';
  const factionBadge = factionCode ? (FACTION_BADGE_COLORS[factionCode] ?? 'bg-gray-600') : 'bg-gray-700';

  const deckEntry = deck.cards.find((dc) => dc.cardGroup.slug === card.slug);
  const deckQty = deckEntry?.quantity ?? 0;
  const addError = canAddCard(card);
  const greyed = addError === 'MAX_COPIES' || addError === 'TOO_MANY_FACTIONS';

  return (
    <div
      onClick={() => !greyed && addCard(card)}
      className={`
        relative group cursor-pointer rounded-lg border-2 overflow-hidden bg-c-surface
        transition-all duration-100 select-none
        ${rarityBorder}
        ${greyed ? 'opacity-35 cursor-not-allowed' : 'hover:scale-[1.02] hover:brightness-110'}
      `}
      title={name}
    >
      <div className={`relative bg-c-elevated overflow-hidden ${rarity !== 'UNIQUE' ? 'aspect-[744/1039]' : ''}`}>
        {rarity === 'UNIQUE' ? (
          <UniqueCardRenderer reference={getCardReference(card)} className="w-full" />
        ) : image ? (
          <Image src={image} alt={name} fill className="object-cover" sizes="200px" unoptimized />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <span className="text-xs text-c-text-muted text-center">{name}</span>
          </div>
        )}

        {!greyed && (
          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {onZoom && (
              <button
                onClick={(e) => { e.stopPropagation(); onZoom(); }}
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition backdrop-blur-sm"
              >
                <i className="fa-solid fa-magnifying-glass" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); addCard(card); }}
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition backdrop-blur-sm"
            >
              <i className="fa-solid fa-plus" />
            </button>
          </div>
        )}

        {/* Pool qty badge */}
        <div className="absolute top-1 left-1 z-20 bg-black/75 text-white text-[9px] font-bold rounded px-1">
          ×{poolQty}
        </div>

        {/* Deck qty badge */}
        {deckQty > 0 && (
          <div className="absolute top-1 right-1 z-20 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {deckQty}
          </div>
        )}
      </div>

      <div className="px-1.5 py-1 flex items-center gap-1 bg-c-surface">
        {factionCode && (
          <span className={`text-[9px] font-bold px-1 rounded text-white shrink-0 ${factionBadge}`}>
            {factionCode}
          </span>
        )}
        <span className="text-[10px] text-c-text-secondary truncate flex-1">{name}</span>
        {card.mainCost != null && (
          <span className="text-[10px] text-c-text-muted font-mono shrink-0">{card.mainCost}</span>
        )}
      </div>
    </div>
  );
}
