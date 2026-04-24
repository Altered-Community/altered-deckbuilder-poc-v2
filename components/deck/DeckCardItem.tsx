'use client';

import Image from 'next/image';
import type { DeckCard } from '@/lib/types/deck';
import { FACTION_BADGE_COLORS } from '@/lib/types/constants';
import { getCardGroupName, getCardGroupFaction, getCardGroupImage, getRarityFromSlug } from '@/lib/utils/card';
import { useDeckStore } from '@/store/deckStore';

const RARITY_RING: Record<string, string> = {
  RARE:    'ring-blue-400',
  UNIQUE:  'ring-yellow-400',
  EXALTED: 'ring-purple-400',
};

interface DeckCardItemProps {
  deckCard: DeckCard;
}

export default function DeckCardItem({ deckCard }: DeckCardItemProps) {
  const { addCard, decrementCard, removeCard, canAddCard } = useDeckStore();
  const { cardGroup, quantity } = deckCard;

  const name      = getCardGroupName(cardGroup);
  const image     = getCardGroupImage(cardGroup);
  const faction   = getCardGroupFaction(cardGroup);
  const badge     = faction ? (FACTION_BADGE_COLORS[faction] ?? 'bg-gray-600') : '';
  const rarity    = getRarityFromSlug(cardGroup.slug);
  const ring      = RARITY_RING[rarity] ?? '';
  const addable   = canAddCard(cardGroup) === null;

  return (
    <div
      className={`relative rounded-md overflow-hidden aspect-[2/3] bg-c-elevated border border-c-border group cursor-pointer select-none ${ring ? `ring-1 ${ring}` : ''}`}
    >
      {image ? (
        <Image src={image} alt={name} fill className="object-cover" sizes="100px" unoptimized />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-1">
          <span className="text-[9px] text-c-text-muted text-center leading-tight">{name}</span>
        </div>
      )}

      {/* Gradient + infos bas */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 px-1 pb-1 flex flex-col gap-0.5">
        <span className="text-[8px] text-white font-medium leading-tight line-clamp-2">{name}</span>
        <div className="flex items-center gap-0.5">
          {faction && (
            <span className={`text-[7px] font-bold px-0.5 rounded text-white ${badge}`}>{faction}</span>
          )}
          {(cardGroup.mainCost != null || cardGroup.recallCost != null) && (
            <span className="text-[8px] font-mono text-white/80">
              {cardGroup.mainCost ?? '—'}{cardGroup.recallCost != null ? `/${cardGroup.recallCost}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Quantité (haut droite) — caché au survol */}
      <div className="absolute top-1 right-1 bg-black/75 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center group-hover:opacity-0 transition-opacity">
        {quantity}
      </div>

      {/* Contrôles au survol */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
        <div className="flex items-center gap-1">
          <button
            onClick={() => decrementCard(cardGroup.slug)}
            className="w-6 h-6 flex items-center justify-center bg-black/70 hover:bg-red-600 text-white rounded-full text-sm font-bold"
          >
            −
          </button>
          <span className="text-white font-bold text-sm w-5 text-center">{quantity}</span>
          <button
            onClick={() => addCard(cardGroup)}
            disabled={!addable}
            className="w-6 h-6 flex items-center justify-center bg-black/70 hover:bg-green-600 text-white rounded-full text-sm font-bold disabled:opacity-30"
          >
            +
          </button>
        </div>
        <button
          onClick={() => removeCard(cardGroup.slug)}
          className="text-[9px] text-white/60 hover:text-red-400 underline"
        >
          retirer
        </button>
      </div>
    </div>
  );
}
