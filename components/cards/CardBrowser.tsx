'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { fetchCardGroups } from '@/lib/api/cardApi';
import { getCardGroupFaction, getCardGroupImage, getCardGroupName, getRarityFromSlug, getCardReference } from '@/lib/utils/card';
import type { CardGroupFilters, CardGroup } from '@/lib/types/card';
import { useDeckStore } from '@/store/deckStore';
import UniqueCardRenderer from '@/components/cards/UniqueCardRenderer';
import CardFiltersPanel from './CardFilters';
import CardItem from './CardItem';

const DEFAULT_RARITIES = ['COMMON', 'RARE', 'EXALTED'];

interface Props {
  initialFaction?: string;
}

export default function CardBrowser({ initialFaction }: Props) {
  const t = useTranslations('cards');
  const locale = useLocale();
  const hero = useDeckStore((s) => s.deck.hero);

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const [filters, setFilters] = useState<CardGroupFilters>({
    page: 1,
    'order[set.date]': 'desc',
    'rarity': DEFAULT_RARITIES,
    ...(initialFaction ? { 'faction': initialFaction } : {}),
  });

  const factionCode = hero ? getCardGroupFaction(hero) : initialFaction;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['cards', filters, factionCode, locale],
    queryFn: () =>
        fetchCardGroups({
          ...filters,
          'faction': factionCode,
          excludeCardTypes: ['HERO'],
        }, locale),
    enabled: !!factionCode,
    placeholderData: (prev) => prev,
  });

  const cards: CardGroup[] = data?.data ?? [];

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setLightboxIdx(i => i !== null && i > 0 ? i - 1 : i);
      if (e.key === 'ArrowRight') setLightboxIdx(i => i !== null && i < cards.length - 1 ? i + 1 : i);
      if (e.key === 'Escape')     setLightboxIdx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, cards.length]);

  const lightboxCard   = lightboxIdx !== null ? cards[lightboxIdx] ?? null : null;
  const lbRarity       = lightboxCard ? getRarityFromSlug(lightboxCard.slug) : null;
  const lbReference    = lightboxCard ? getCardReference(lightboxCard) : null;
  const lbImage        = lightboxCard && lbRarity !== 'UNIQUE' ? getCardGroupImage(lightboxCard, locale) : null;
  const lbName         = lightboxCard ? getCardGroupName(lightboxCard) : '';
  const totalItems = data?.pagination?.totalItems ?? 0;
  const currentPage = filters.page ?? 1;
  const lastPage = data?.pagination?.lastPage ?? 1;

  const rarityFilter = filters['rarity'];
  const selectedRarities = Array.isArray(rarityFilter) ? rarityFilter : rarityFilter ? [rarityFilter] : [];

  const toggleRarity = (ref: string) => {
    const next = selectedRarities.includes(ref)
      ? selectedRarities.filter((r) => r !== ref)
      : [...selectedRarities, ref];
    setFilters((f) => ({ ...f, 'rarity': next, page: 1 }));
  };

  const handleFiltersChange = (newFilters: CardGroupFilters) => {
    setFilters({ ...newFilters, 'rarity': selectedRarities });
  };

  return (
    <div className="flex flex-col h-full gap-2">
      <CardFiltersPanel
        filters={filters}
        onChange={handleFiltersChange}
        selectedRarities={selectedRarities}
        onToggleRarity={toggleRarity}
        excludeTypes={['HERO']}
      />

      {/* Pagination — au-dessus des cartes */}
      <div className="shrink-0 flex items-center justify-between gap-2 text-xs text-c-text-muted px-1 pb-1 border-b border-c-border-subtle">
        <span className="text-c-text-subtle">{t('count', { count: totalItems })}</span>
        <div className="flex items-center gap-2">
          <button
            disabled={currentPage <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: currentPage - 1 }))}
            className="px-2 py-0.5 bg-c-input rounded disabled:opacity-30 hover:bg-c-border"
          >
            ‹
          </button>
          <span>{t('page', { current: currentPage, last: lastPage })}</span>
          <button
            disabled={currentPage >= lastPage}
            onClick={() => setFilters((f) => ({ ...f, page: currentPage + 1 }))}
            className="px-2 py-0.5 bg-c-input rounded disabled:opacity-30 hover:bg-c-border"
          >
            ›
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-c-text-muted">
            <span className="text-2xl">⚠️</span>
            <p className="text-sm">{t('apiError')}</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-c-text-muted text-sm">
            {t('notFound')}
          </div>
        ) : (
          <div
            className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 md:gap-3 transition-opacity ${isFetching ? 'opacity-60' : ''}`}
          >
            {cards.map((card, idx) => (
              <CardItem key={card.slug} card={card} onZoom={() => setLightboxIdx(idx)} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination — sous les cartes */}
      <div className="shrink-0 flex items-center justify-between gap-2 text-xs text-c-text-muted px-1 pt-1 border-t border-c-border-subtle">
        <span className="text-c-text-subtle">{t('count', { count: totalItems })}</span>
        <div className="flex items-center gap-2">
          <button
            disabled={currentPage <= 1}
            onClick={() => setFilters((f) => ({ ...f, page: currentPage - 1 }))}
            className="px-2 py-0.5 bg-c-input rounded disabled:opacity-30 hover:bg-c-border"
          >
            ‹
          </button>
          <span>{t('page', { current: currentPage, last: lastPage })}</span>
          <button
            disabled={currentPage >= lastPage}
            onClick={() => setFilters((f) => ({ ...f, page: currentPage + 1 }))}
            className="px-2 py-0.5 bg-c-input rounded disabled:opacity-30 hover:bg-c-border"
          >
            ›
          </button>
        </div>
      </div>

      {lightboxIdx !== null && lightboxCard && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center" style={{ zIndex: 9999 }}
          onClick={() => setLightboxIdx(null)}
        >
          {/* Card image */}
          <div onClick={(e) => e.stopPropagation()} className="relative flex items-center justify-center">
            {lbRarity === 'UNIQUE' && lbReference ? (
              <div style={{ width: 'min(52vh, 88vw)' }}>
                <UniqueCardRenderer reference={lbReference} locale={locale} className="w-full" />
              </div>
            ) : lbImage ? (
              <div className="relative" style={{ height: '85vh', aspectRatio: '744/1039' }}>
                <Image src={lbImage} alt={lbName} fill className="object-contain" unoptimized sizes="600px" />
              </div>
            ) : (
              <div className="flex items-center justify-center bg-c-surface rounded-xl p-8" style={{ height: '60vh', aspectRatio: '744/1039' }}>
                <span className="text-white text-sm text-center">{lbName}</span>
              </div>
            )}
          </div>

          {/* Prev */}
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => i !== null ? Math.max(0, i - 1) : i); }}
            disabled={lightboxIdx === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white disabled:opacity-20 transition text-2xl font-light"
          >
            <i className="fa-solid fa-chevron-left text-base" />
          </button>

          {/* Next */}
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => i !== null ? Math.min(cards.length - 1, i + 1) : i); }}
            disabled={lightboxIdx === cards.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white disabled:opacity-20 transition"
          >
            <i className="fa-solid fa-chevron-right text-base" />
          </button>

          {/* Close */}
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <i className="fa-solid fa-xmark" />
          </button>

          {/* Name + counter */}
          <div className="absolute bottom-5 left-0 right-0 text-center pointer-events-none">
            <span className="text-white text-sm font-semibold drop-shadow">{lbName}</span>
            <span className="text-white/40 text-xs ml-3">{lightboxIdx + 1} / {cards.length}</span>
          </div>
        </div>
      )}

    </div>
  );
}
