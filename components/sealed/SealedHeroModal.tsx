'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { getCardGroupName, getCardGroupFaction, getCdnImageUrl, getRarityFromSlug } from '@/lib/utils/card';
import { useSealedStore } from '@/store/sealedStore';
import { FACTION_BADGE_COLORS } from '@/lib/types/constants';
import type { CardGroup } from '@/lib/types/card';

interface Props {
  onClose: () => void;
}

export default function SealedHeroModal({ onClose }: Props) {
  const t = useTranslations('sealed');
  const { deck, heroPool, setHero, deckFactions } = useSealedStore();
  const [factionFilter, setFactionFilter] = useState('');

  const deckFactionList = deckFactions();

  const poolFactions = Array.from(
    new Set(heroPool.map((h) => getCardGroupFaction(h)).filter(Boolean) as string[])
  ).sort();

  const heroes = heroPool.filter((h) => {
    const hf = getCardGroupFaction(h);
    if (deckFactionList.length > 0 && hf && !deckFactionList.includes(hf)) return false;
    if (factionFilter && hf !== factionFilter) return false;
    return true;
  });

  const handleSelect = (hero: CardGroup) => {
    setHero(deck.hero?.slug === hero.slug ? null : hero);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-c-surface rounded-2xl border border-c-border w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-c-border">
          <h2 className="font-bold text-c-text">{t('selectHero')}</h2>
          <div className="flex items-center gap-3">
            {poolFactions.length > 1 && (
              <select
                value={factionFilter}
                onChange={(e) => setFactionFilter(e.target.value)}
                className="px-2 py-1 bg-c-input border border-c-border rounded text-c-text text-xs focus:outline-none"
              >
                <option value="">{deckFactionList.length > 0 ? t('deckFactions') : t('allFactions')}</option>
                {poolFactions.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            )}
            {deck.hero && (
              <button
                onClick={() => { setHero(null); onClose(); }}
                className="text-xs text-red-400 hover:text-red-300 underline"
              >
                {t('removeHero')}
              </button>
            )}
            <button onClick={onClose} className="text-c-text-muted hover:text-c-text">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {heroes.length === 0 ? (
            <p className="text-center text-c-text-muted text-sm py-12">{t('noHeroForFaction')}</p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {heroes.map((hero) => (
                <HeroMiniCard
                  key={hero.slug}
                  hero={hero}
                  isSelected={deck.hero?.slug === hero.slug}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HeroMiniCard({ hero, isSelected, onSelect }: {
  hero: CardGroup;
  isSelected: boolean;
  onSelect: (h: CardGroup) => void;
}) {
  const locale = useLocale();
  const name = getCardGroupName(hero);
  const factionCode = getCardGroupFaction(hero);
  const factionBadge = factionCode ? (FACTION_BADGE_COLORS[factionCode] ?? 'bg-gray-600') : 'bg-gray-700';

  const image = hero.cards
    .map((c) => getRarityFromSlug(c.reference) !== 'UNIQUE' ? getCdnImageUrl(c.reference, locale) : c.imagePath)
    .filter(Boolean)[0] ?? null;

  return (
    <div
      onClick={() => onSelect(hero)}
      className={`
        relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all
        ${isSelected ? 'border-yellow-400 ring-2 ring-yellow-400/40' : 'border-c-border hover:border-c-text-muted hover:scale-[1.02]'}
      `}
    >
      <div className="aspect-[2/3] relative bg-c-elevated">
        {image ? (
          <Image src={image} alt={name} fill className="object-cover" sizes="120px" unoptimized />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-1">
            <span className="text-[10px] text-c-text-muted text-center">{name}</span>
          </div>
        )}
        {isSelected && (
          <div className="absolute inset-0 bg-yellow-400/20 flex items-center justify-center">
            <span className="text-2xl">★</span>
          </div>
        )}
      </div>
      <div className="px-1.5 py-1 bg-c-surface flex flex-col gap-0.5">
        <span className="text-[10px] text-c-text font-semibold truncate">{name}</span>
        {factionCode && (
          <span className={`text-[9px] font-bold px-1 rounded text-white w-fit ${factionBadge}`}>
            {factionCode}
          </span>
        )}
      </div>
    </div>
  );
}
