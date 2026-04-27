'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { fetchCardGroups } from '@/lib/api/cardApi';
import { getCardGroupName, getCardGroupFaction } from '@/lib/utils/card';
import { useDeckStore } from '@/store/deckStore';
import { FACTIONS, FACTION_BADGE_COLORS } from '@/lib/types/constants';
import type { CardGroup } from '@/lib/types/card';
import SiteFooter from '@/components/layout/SiteFooter';

export default function HeroSelector() {
  const t = useTranslations();
  const router = useRouter();
  const { setHero, deck } = useDeckStore();
  const [factionFilter, setFactionFilter] = useState('');

  const baseFilters = {
    cardType: 'HERO',
    'order[set.date]': 'desc' as const,
    ...(factionFilter ? { 'faction': factionFilter } : {}),
  };

  const heroCache = { staleTime: 1000 * 60 * 60, gcTime: 1000 * 60 * 60 * 24 };

  const { data: firstPage } = useQuery({
    queryKey: ['heroes', baseFilters, 1],
    queryFn: () => fetchCardGroups({ ...baseFilters, page: 1 }),
    ...heroCache,
  });

  const lastPage = firstPage?.pagination.lastPage ?? 1;

  const results = useQueries({
    queries: Array.from({ length: lastPage }, (_, i) => i + 1).map((page) => ({
      queryKey: ['heroes', baseFilters, page],
      queryFn: () => fetchCardGroups({ ...baseFilters, page }),
      ...heroCache,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const allHeroes = results.flatMap((r) => r.data?.data ?? []);

  const seen = new Set<string>();
  const heroes = allHeroes.filter((h) => {
    if (seen.has(h.slug)) return false;
    seen.add(h.slug);
    return true;
  });

  const handleSelect = (hero: CardGroup) => {
    setHero(hero);
    const faction = getCardGroupFaction(hero);
    router.push(faction ? `/deck?faction=${faction}` : '/deck');
  };

  const selectClass = 'px-3 py-2 bg-c-elevated border border-c-border rounded-lg text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="flex flex-col" style={{ flex: 1 }}>
      <header className="shrink-0 px-4 sm:px-8 pt-6 sm:pt-10 pb-4 sm:pb-5 text-center">
        <h1 className="text-3xl font-bold text-c-text tracking-tight mb-1">
          {t('hero.title')}
        </h1>
        <p className="text-c-text-subtle text-sm">{t('hero.subtitle')}</p>
      </header>

      {deck.hero && (
        <div className="mx-auto mb-4 flex items-center gap-3 bg-yellow-100/80 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700/40 rounded-xl px-5 py-3">
          <span className="text-yellow-500 dark:text-yellow-400">★</span>
          <span className="text-yellow-800 dark:text-yellow-200 text-sm">
            {t('hero.current', { name: getCardGroupName(deck.hero) })}
          </span>
          <button
            onClick={() => router.push('/deck')}
            className="ml-4 px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-bold rounded"
          >
            {t('hero.continue')}
          </button>
        </div>
      )}

      <div className="w-full px-4 sm:px-6 mb-4 flex flex-wrap gap-3 items-center">
        <select value={factionFilter} onChange={(e) => setFactionFilter(e.target.value)} className={selectClass}>
          <option value="">{t('hero.allFactions')}</option>
          {Object.entries(FACTIONS).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>

        {heroes.length > 0 && (
          <span className="text-xs text-c-text-subtle ml-auto">{t('hero.heroCount', { count: heroes.length })}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400" />
          </div>
        ) : heroes.length === 0 ? (
          <div className="flex justify-center py-20 text-c-text-muted text-sm">
            {t('hero.notFound')}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
            {heroes.map((hero) => (
              <HeroCard
                key={hero.slug}
                hero={hero}
                isSelected={deck.hero?.slug === hero.slug}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

function HeroCard({ hero, isSelected, onSelect }: {
  hero: CardGroup;
  isSelected: boolean;
  onSelect: (h: CardGroup) => void;
}) {
  const [imgIndex, setImgIndex] = useState(0);

  const name = getCardGroupName(hero);
  const factionCode = getCardGroupFaction(hero);
  const factionBadge = factionCode ? (FACTION_BADGE_COLORS[factionCode] ?? 'bg-gray-600') : 'bg-gray-700';
  const factionName = factionCode ? FACTIONS[factionCode] : '';

  const images = hero.cards
    .map((c) => c.imagePath)
    .filter((p): p is string => !!p);
  const currentImage = images[imgIndex] ?? null;
  const hasMultiple = images.length > 1;

  const prev = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const next = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setImgIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  return (
    <button
      onClick={() => onSelect(hero)}
      className={`
        group relative flex flex-col rounded-xl overflow-hidden border-2 transition-all duration-150 text-left
        ${isSelected
          ? 'border-yellow-400 ring-2 ring-yellow-400/40 scale-[1.02]'
          : 'border-c-border hover:border-c-text-muted hover:scale-[1.02]'
        }
      `}
    >
      <div className="aspect-[2/3] relative bg-c-elevated">
        {currentImage ? (
          <Image src={currentImage} alt={name} fill className="object-cover" sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw" unoptimized />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-c-text-muted text-sm text-center px-2">{name}</span>
          </div>
        )}

        {isSelected && (
          <div className="absolute inset-0 bg-yellow-400/10 flex items-center justify-center">
            <span className="text-3xl">★</span>
          </div>
        )}

        {hasMultiple && (
          <>
            <button
              onClick={prev}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              ‹
            </button>
            <button
              onClick={next}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              ›
            </button>
            <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1 z-10">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setImgIndex(i); }}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIndex ? 'bg-white' : 'bg-white/30'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="px-2 py-2 bg-c-surface flex flex-col gap-0.5">
        <span className="text-c-text text-xs font-semibold truncate">{name}</span>
        <div className="flex items-center gap-1.5">
          {factionCode && (
            <span className={`text-[9px] font-bold px-1 rounded text-white ${factionBadge}`}>
              {factionCode}
            </span>
          )}
          <span className="text-[10px] text-c-text-subtle">{factionName}</span>
          {hasMultiple && (
            <span className="ml-auto text-[9px] text-c-text-subtle">{imgIndex + 1}/{images.length}</span>
          )}
        </div>
      </div>
    </button>
  );
}
