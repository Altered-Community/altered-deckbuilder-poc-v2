'use client';

import Image from 'next/image';
import type { CardGroup } from '@/lib/types/card';
import { FACTION_BADGE_COLORS } from '@/lib/types/constants';
import { getCardGroupName, getCardGroupImage, getCardGroupFaction, getRarityFromSlug } from '@/lib/utils/card';
import { useDeckStore } from '@/store/deckStore';

const RARITY_BORDER: Record<string, string> = {
  COMMON: 'border-gray-500',
  RARE: 'border-blue-400',
  UNIQUE: 'border-purple-400',
  EXALTED: 'border-yellow-400',
};

interface CardItemProps {
  card: CardGroup;
}

export default function CardItem({ card }: CardItemProps) {
  const { addCard, setHero, deck, canAddCard } = useDeckStore();

  const name = getCardGroupName(card);
  const image = getCardGroupImage(card);
  const factionCode = getCardGroupFaction(card);
  const rarity = getRarityFromSlug(card.slug);
  const rarityBorder = RARITY_BORDER[rarity] ?? 'border-gray-600';
  const factionBadge = factionCode ? (FACTION_BADGE_COLORS[factionCode] ?? 'bg-gray-600') : 'bg-gray-700';
  const isHero = card.cardType?.reference === 'HERO';
  const isHeroSelected = isHero && deck.hero?.slug === card.slug;
  const deckEntry = deck.cards.find((dc) => dc.cardGroup.slug === card.slug);
  const addError = canAddCard(card);
  const greyed = !isHero && (addError === 'MAX_COPIES' || addError === 'MAX_RARE' || addError === 'MAX_UNIQUE' || addError === 'MAX_EXALTED');

  const handleClick = () => {
    if (isHero) {
      setHero(isHeroSelected ? null : card);
    } else {
      addCard(card);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        relative group cursor-pointer rounded-lg border-2 overflow-hidden bg-c-surface
        transition-all duration-100 select-none
        ${rarityBorder}
        ${greyed ? 'opacity-35 cursor-not-allowed' : 'hover:scale-[1.02] hover:brightness-110'}
        ${isHeroSelected ? 'ring-2 ring-yellow-400' : ''}
      `}
      title={name}
    >
      <div className="aspect-[2/3] relative bg-c-elevated">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            className="object-cover"
            sizes="200px"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <span className="text-xs text-c-text-muted text-center">{name}</span>
          </div>
        )}

        {(deckEntry || isHeroSelected) && (
          <div className="absolute top-1 right-1 bg-black/80 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {isHero ? '★' : deckEntry?.quantity}
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
