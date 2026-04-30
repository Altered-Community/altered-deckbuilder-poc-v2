'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { fetchCardGroups } from '@/lib/api/cardApi';
import { getCardGroupFaction } from '@/lib/utils/card';
import type { CardGroupFilters, CardGroup } from '@/lib/types/card';
import { useDeckStore } from '@/store/deckStore';
import CardFiltersPanel from './CardFilters';
import CardItem from './CardItem';

const DEFAULT_RARITIES = ['COMMON', 'RARE', 'EXALTED'];

interface Props {
  initialFaction?: string;
}

export default function CardBrowser({ initialFaction }: Props) {
  const t = useTranslations('cards');
  const hero = useDeckStore((s) => s.deck.hero);

  const [filters, setFilters] = useState<CardGroupFilters>({
    page: 1,
    'order[set.date]': 'desc',
    'rarity': DEFAULT_RARITIES,
    ...(initialFaction ? { 'faction': initialFaction } : {}),
  });

  const factionCode = hero ? getCardGroupFaction(hero) : initialFaction;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['cards', filters, factionCode],
    queryFn: () =>
        fetchCardGroups({
          ...filters,
          'faction': factionCode,
        }),
    enabled: !!factionCode,
    placeholderData: (prev) => prev,
  });

  const cards: CardGroup[] = data?.data ?? [];
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
            {cards.map((card) => (
              <CardItem key={card.slug} card={card} />
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
    </div>
  );
}
