'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCardGroups } from '@/lib/api/cardApi';
import { getCardGroupFaction } from '@/lib/utils/card';
import type { CardGroupFilters, CardGroup } from '@/lib/types/card';
import { RARITIES } from '@/lib/types/constants';
import { useDeckStore } from '@/store/deckStore';
import CardFiltersPanel from './CardFilters';
import CardItem from './CardItem';

const DEFAULT_RARITIES = ['COMMON', 'RARE', 'EXALTED'];

interface Props {
  initialFaction?: string;
}

export default function CardBrowser({ initialFaction }: Props) {
  const hero = useDeckStore((s) => s.deck.hero);

  const [filters, setFilters] = useState<CardGroupFilters>({
    page: 1,
    'order[set.date]': 'desc',
    'rarity.reference': DEFAULT_RARITIES,
    ...(initialFaction ? { 'faction.code': initialFaction } : {}),
  });



  const factionCode = hero ? getCardGroupFaction(hero) : initialFaction;

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ['cards', filters, factionCode],
    queryFn: () =>
        fetchCardGroups({
          ...filters,
          'faction.code': factionCode,
        }),
    enabled: !!factionCode,
    placeholderData: (prev) => prev,
  });



  const cards: CardGroup[] = data?.data ?? [];
  const totalItems = data?.pagination?.totalItems ?? 0;
  const currentPage = filters.page ?? 1;
  const lastPage = data?.pagination?.lastPage ?? 1;

  const rarityFilter = filters['rarity.reference'];
  const selectedRarities = Array.isArray(rarityFilter) ? rarityFilter : rarityFilter ? [rarityFilter] : [];

  const toggleRarity = (ref: string) => {
    const next = selectedRarities.includes(ref)
      ? selectedRarities.filter((r) => r !== ref)
      : [...selectedRarities, ref];
    setFilters((f) => ({ ...f, 'rarity.reference': next, page: 1 }));
  };

  const handleFiltersChange = (newFilters: CardGroupFilters) => {
    setFilters({ ...newFilters, 'rarity.reference': selectedRarities });
  };

  return (
    <div className="flex flex-col h-full gap-2">
      <CardFiltersPanel filters={filters} onChange={handleFiltersChange} />

      {/* Checkboxes rareté */}
      <div className="flex items-center gap-4 px-1">
        {RARITIES.map((r) => (
          <label key={r.value} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedRarities.includes(r.value)}
              onChange={() => toggleRarity(r.value)}
              className="w-3.5 h-3.5 accent-blue-500"
            />
            <span className="text-xs text-c-text-secondary">{r.label}</span>
          </label>
        ))}
        <span className="ml-auto text-xs text-c-text-subtle">{totalItems} cartes</span>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2 text-xs text-c-text-muted px-1">
        <button
          disabled={currentPage <= 1}
          onClick={() => setFilters((f) => ({ ...f, page: currentPage - 1 }))}
          className="px-2 py-0.5 bg-c-input rounded disabled:opacity-30 hover:bg-c-border"
        >
          ‹
        </button>
        <span>Page {currentPage} / {lastPage}</span>
        <button
          disabled={currentPage >= lastPage}
          onClick={() => setFilters((f) => ({ ...f, page: currentPage + 1 }))}
          className="px-2 py-0.5 bg-c-input rounded disabled:opacity-30 hover:bg-c-border"
        >
          ›
        </button>
      </div>

      {/* Grille */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-c-text-muted">
            <span className="text-2xl">⚠️</span>
            <p className="text-sm">Impossible de joindre l&apos;API</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-c-text-muted text-sm">
            Aucune carte trouvée
          </div>
        ) : (
          <div
            className={`grid gap-3 transition-opacity ${isFetching ? 'opacity-60' : ''}`}
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
          >
            {cards.map((card) => (
              <CardItem key={card.slug} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
