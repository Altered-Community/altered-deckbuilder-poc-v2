'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { fetchCardGroups, fetchCardGroupsByRefs } from '@/lib/api/cardApi';
import { getCardGroupFaction, getCardGroupImage, getCardGroupName, getRarityFromSlug, getCardReference } from '@/lib/utils/card';
import type { CardGroupFilters, CardGroup } from '@/lib/types/card';
import { useDeckStore } from '@/store/deckStore';
import { useAuth } from '@/lib/hooks/useAuth';
import { useCollection } from '@/lib/hooks/useCollection';
import UniqueCardRenderer from '@/components/cards/UniqueCardRenderer';
import CardFiltersPanel from './CardFilters';
import CardItem from './CardItem';

const DEFAULT_RARITIES = ['COMMON', 'RARE', 'EXALTED'];

const normalizeRef = (ref: string) =>
  ref.replace(/^ALT_COREKS_/, 'ALT_CORE_').replace(/^ALT_WCS25_/, 'ALT_CORE_');

interface Props {
  initialFaction?: string;
}

export default function CardBrowser({ initialFaction }: Props) {
  const t = useTranslations('cards');
  const locale = useLocale();
  const hero = useDeckStore((s) => s.deck.hero);
  const { isAuthenticated } = useAuth();

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [showOnlyOwned, setShowOnlyOwned] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [filters, setFilters] = useState<CardGroupFilters>({
    page: 1,
    'order[collectorNumberFormatedId]': 'asc',
    'rarity': DEFAULT_RARITIES,
    ...(initialFaction ? { 'faction': initialFaction } : {}),
  });

  const factionCode = hero ? getCardGroupFaction(hero) : initialFaction;
  const format = useDeckStore((s) => s.deck.format);
  const isSandbox = format?.code === 'sandbox';


  const { data: normalData, isLoading: normalLoading, isFetching: normalFetching, isError: normalError } = useQuery({
    queryKey: ['cards', filters, isSandbox ? 'sandbox' : factionCode, locale],
    queryFn: () => fetchCardGroups({ ...filters, faction: isSandbox ? filters.faction : factionCode, excludeCardTypes: ['HERO'] }, locale),
    enabled: (isSandbox || !!factionCode) && !showOnlyOwned,
    placeholderData: (prev) => prev,
  });

  const { data: collectionEntries } = useCollection(isAuthenticated);

  const ownedRefs = useMemo(
    () => (collectionEntries ? collectionEntries.map((e) => e.cardReference) : null),
    [collectionEntries],
  );

  // Map base-ref → quantité possédée (pour badge sur CardItem)
  const ownedCountMap = useMemo(() => {
    if (!collectionEntries) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const e of collectionEntries) {
      const base = normalizeRef(e.cardReference).split('_').slice(0, 6).join('_');
      map.set(base, (map.get(base) ?? 0) + e.quantity);
    }
    return map;
  }, [collectionEntries]);

  const { data: ownedGroups, isLoading: ownedLoading, isFetching: ownedFetching, isError: ownedError } = useQuery({
    queryKey: ['cards-owned', locale, ownedRefs?.length ?? 0],
    queryFn: () => fetchCardGroupsByRefs(ownedRefs!, locale),
    enabled: showOnlyOwned && ownedRefs !== null,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const applyCostAndEffectFilters = (g: CardGroup) => {
    if (filters.costComparison) {
      const m = g.mainCost;
      const r = g.recallCost;
      if (m === null || r === null) return false;
      if (filters.costComparison === 'equal' && m !== r) return false;
      if (filters.costComparison === 'mainHigher' && m <= r) return false;
      if (filters.costComparison === 'recallHigher' && r <= m) return false;
    }
    return true;
  };

  const filteredOwnedGroups = useMemo(() => {
    if (!ownedGroups) return [];
    return ownedGroups.filter((g) => {
      if (g.cardType?.reference === 'HERO') return false;
      if (!isSandbox && factionCode && g.faction?.code !== factionCode) return false;
      if (isSandbox) {
        const factionFilters = Array.isArray(filters.faction) ? filters.faction : filters.faction ? [filters.faction] : [];
        if (factionFilters.length && !factionFilters.includes(g.faction?.code ?? '')) return false;
      }
      const name = filters.name?.toLowerCase();
      if (name && !g.name?.toLowerCase().includes(name)) return false;
      const rarity = Array.isArray(filters.rarity) ? filters.rarity : filters.rarity ? [filters.rarity] : [];
      if (rarity.length && !rarity.includes(getRarityFromSlug(g.slug))) return false;
      const ct = Array.isArray(filters.cardType) ? filters.cardType : filters.cardType ? [filters.cardType] : [];
      if (ct.length && !ct.includes(g.cardType?.reference ?? '')) return false;
      if (filters.mainCost !== undefined && filters.mainCost !== '' && g.mainCost !== Number(filters.mainCost)) return false;
      if (filters.recallCost !== undefined && filters.recallCost !== '' && g.recallCost !== Number(filters.recallCost)) return false;
      if (filters['set.reference'] && !g.cards.some((v) => v.set.reference === filters['set.reference'])) return false;
      if (!applyCostAndEffectFilters(g)) return false;
      return true;
    });
  }, [ownedGroups, factionCode, isSandbox, filters]);

  const isLoading  = showOnlyOwned ? ownedLoading  : normalLoading;
  const isFetching = showOnlyOwned ? ownedFetching  : normalFetching;
  const isError    = showOnlyOwned ? ownedError     : normalError;

  const ITEMS_PER_PAGE = 30;
  const currentPage = filters.page ?? 1;

  const cards: CardGroup[] = useMemo(() => {
    if (!showOnlyOwned) {
      const base = normalData?.data ?? [];
      return filters.costComparison ? base.filter(applyCostAndEffectFilters) : base;
    }
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOwnedGroups.slice(start, start + ITEMS_PER_PAGE);
  }, [showOnlyOwned, normalData, filteredOwnedGroups, currentPage, filters.costComparison]);

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
  const totalItems = showOnlyOwned ? filteredOwnedGroups.length : (normalData?.pagination?.totalItems ?? 0);
  const lastPage   = showOnlyOwned
    ? Math.max(1, Math.ceil(filteredOwnedGroups.length / ITEMS_PER_PAGE))
    : (normalData?.pagination?.lastPage ?? 1);

  const rarityFilter = filters['rarity'];
  const selectedRarities = Array.isArray(rarityFilter) ? rarityFilter : rarityFilter ? [rarityFilter] : [];

  const toggleRarity = (ref: string) => {
    const next = selectedRarities.includes(ref)
      ? selectedRarities.filter((r) => r !== ref)
      : [...selectedRarities, ref];
    setFilters((f) => ({ ...f, 'rarity': next, page: 1 }));
  };

  const INITIAL_FILTERS: CardGroupFilters = {
    page: 1,
    'order[collectorNumberFormatedId]': 'asc',
    'rarity': DEFAULT_RARITIES,
    ...(initialFaction ? { 'faction': initialFaction } : {}),
  };

  const handleFiltersChange = (newFilters: CardGroupFilters) => {
    const hasActiveEffects =
      newFilters.effectSlots?.some(s => s.trigger || s.condition || s.output) ||
      newFilters.supportEffectSlots?.some(s => s.trigger || s.condition || s.output);

    let rarity = newFilters.reference ? undefined : selectedRarities;
    if (hasActiveEffects && rarity && !rarity.includes('UNIQUE')) {
      rarity = [...rarity, 'UNIQUE'];
    }
    setFilters({ ...newFilters, 'rarity': rarity });
  };

  const handleReset = () => {
    setFilters(INITIAL_FILTERS);
    setShowOnlyOwned(false);
  };

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => {
    if (['page', 'order[collectorNumberFormatedId]'].includes(k)) return false;
    if (k === 'faction' && !isSandbox && initialFaction) return false;
    if (k === 'rarity') {
      const arr = (Array.isArray(v) ? [...v] : v ? [v] : []).sort();
      return arr.join(',') !== [...DEFAULT_RARITIES].sort().join(',');
    }
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '';
  }) || showOnlyOwned;

  return (
    <div className="flex flex-col h-full gap-2">

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition select-none
            ${filtersOpen ? 'bg-c-input border-c-border text-c-text' : 'bg-transparent border-c-border text-c-text-muted hover:text-c-text'}`}
        >
          <i className="fa-solid fa-gear text-[10px]" />
          {t('filters')}
          <i className={`fa-solid fa-chevron-${filtersOpen ? 'up' : 'down'} text-[10px]`} />
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
        </button>

        <div className="flex-1" />

        <span className="text-xs text-c-text-muted">{t('count', { count: totalItems })}</span>

        <div className="flex items-center gap-0.5 border border-c-border rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`w-7 h-7 flex items-center justify-center transition ${viewMode === 'grid' ? 'bg-c-input text-c-text' : 'text-c-text-muted hover:text-c-text'}`}
          >
            <i className="fa-solid fa-grip text-xs" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`w-7 h-7 flex items-center justify-center transition ${viewMode === 'list' ? 'bg-c-input text-c-text' : 'text-c-text-muted hover:text-c-text'}`}
          >
            <i className="fa-solid fa-list text-xs" />
          </button>
        </div>
      </div>

      {filtersOpen && <CardFiltersPanel
        filters={filters}
        onChange={handleFiltersChange}
        onReset={handleReset}
        selectedRarities={selectedRarities}
        onToggleRarity={toggleRarity}
        excludeTypes={['HERO']}
        showOnlyOwned={showOnlyOwned}
        onToggleOwned={() => { setShowOnlyOwned((v) => !v); setFilters((f) => ({ ...f, page: 1 })); }}
        isAuthenticated={isAuthenticated}
      />}

      {/* Pagination */}
      <div className="shrink-0 flex items-center justify-end gap-2 text-xs text-c-text-muted px-1 pb-1 border-b border-c-border-subtle">
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
            className={`transition-opacity ${isFetching ? 'opacity-60' : ''} ${
              viewMode === 'grid'
                ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 md:gap-3'
                : 'flex flex-col gap-1'
            }`}
          >
            {cards.map((card, idx) => {
              let ownedCount: number | undefined;
              for (const v of card.cards) {
                const base = normalizeRef(v.reference).split('_').slice(0, 6).join('_');
                const count = ownedCountMap.get(base);
                if (count !== undefined) { ownedCount = count; break; }
              }
              return (
                <CardItem
                  key={card.slug}
                  card={card}
                  onZoom={() => setLightboxIdx(idx)}
                  ownedCount={ownedCount}
                  viewMode={viewMode}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination — sous les cartes */}
      <div className="shrink-0 flex items-center justify-end gap-2 text-xs text-c-text-muted px-1 pt-1 border-t border-c-border-subtle">
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
          <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center gap-3">
            {lbRarity === 'UNIQUE' && lbReference ? (
              <div style={{ width: 'min(52vh, 88vw)' }}>
                <UniqueCardRenderer reference={lbReference} locale={locale} className="w-full" />
              </div>
            ) : lbImage ? (
              <div className="relative" style={{ height: '82vh', aspectRatio: '744/1039' }}>
                <Image src={lbImage} alt={lbName} fill className="object-contain" unoptimized sizes="600px" />
              </div>
            ) : (
              <div className="flex items-center justify-center bg-c-surface rounded-xl p-8" style={{ height: '60vh', aspectRatio: '744/1039' }}>
                <span className="text-white text-sm text-center">{lbName}</span>
              </div>
            )}
            {lbReference && (
              <Link
                href={`/cards/${lbReference}`}
                onClick={() => setLightboxIdx(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition backdrop-blur-sm"
              >
                <i className="fa-solid fa-circle-info text-xs" />
                {lbName}
              </Link>
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

          {/* Counter */}
          <div className="absolute bottom-5 left-0 right-0 text-center pointer-events-none">
            <span className="text-white/40 text-xs">{lightboxIdx + 1} / {cards.length}</span>
          </div>
        </div>
      )}

    </div>
  );
}
