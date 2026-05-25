'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/lib/hooks/useAuth';
import { signIn } from 'next-auth/react';
import { getCollection, deleteCollectionEntry, updateCollectionEntry } from '@/lib/api/collectionApi';

const USE_KEYCLOAK = process.env.NEXT_PUBLIC_USE_KEYCLOAK === 'true';
import type { ApiCollectionEntry } from '@/lib/types/collection';
import { getCdnImageUrl, getRarityFromSlug } from '@/lib/utils/card';
import { FACTIONS, SET_NAMES, CARD_TYPES } from '@/lib/types/constants';
import SiteLayout from '@/components/layout/SiteLayout';
import LoginButton from '@/components/auth/LoginButton';
import UniqueCardRenderer from '@/components/cards/UniqueCardRenderer';
import Image from 'next/image';

const RARITY_ORDER = ['COMMON', 'RARE', 'UNIQUE', 'EXALTED'];
const GEM_KEYS: Record<string, string> = {
  COMMON: 'C', RARE: 'R', UNIQUE: 'U', EXALTED: 'E',
};
const SET_ICONS: Record<string, string> = {
  FUGUE: 'fa-kit fa-nej',
  EOLE: 'fa-kit fa-roc',
  DUSTER: 'fa-kit fa-sdu',
  CYCLONE: 'fa-kit fa-sky',
  BISE: 'fa-kit fa-wfm',
  ALIZE: 'fa-kit fa-tbf',
  COREKS: 'fa-kit fa-ks-set-icon',
  CORE: 'fa-kit fa-ext-coreset',
};

export default function CollectionPage() {
  const t = useTranslations('collection');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [entries, setEntries] = useState<ApiCollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [updating, setUpdating] = useState<number | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [gridSize, setGridSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 48;

  // Filters
  const [search, setSearch] = useState('');
  const [filterFactions, setFilterFactions] = useState<string[]>([]);
  const [filterRarities, setFilterRarities] = useState<string[]>([]);
  const [filterSets, setFilterSets] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated && USE_KEYCLOAK) signIn('keycloak');
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const data = await getCollection();
        if (active) setEntries(data);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : tc('unknownError'));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [isAuthenticated, tc]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      if (q && !(e.name ?? e.cardReference).toLowerCase().includes(q) && !e.cardReference.toLowerCase().includes(q)) return false;
      if (filterFactions.length && !filterFactions.includes(e.faction)) return false;
      if (filterRarities.length && !filterRarities.includes(e.rarity?.toUpperCase())) return false;
      if (filterSets.length && !filterSets.includes(e.cardSet)) return false;
      if (filterTypes.length && !filterTypes.includes(e.cardType?.toUpperCase() ?? '')) return false;
      return true;
    });
  }, [entries, search, filterFactions, filterRarities, filterSets, filterTypes]);

  const lightbox = lightboxIdx !== null ? (filtered[lightboxIdx] ?? null) : null;

  const handleDelete = async (id: number) => {
    if (!confirm(t('deleteConfirm'))) return;
    setDeleting(id);
    try {
      await deleteCollectionEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (lightbox?.id === id) setLightboxIdx(null);
    } finally {
      setDeleting(null);
    }
  };

  const handleUpdateQuantity = async (entry: ApiCollectionEntry, delta: number) => {
    const newQty = entry.quantity + delta;
    if (newQty <= 0) {
      await handleDelete(entry.id);
      return;
    }
    setUpdating(entry.id);
    try {
      const updated = await updateCollectionEntry(entry.id, newQty);
      setEntries((prev) => prev.map((e) => e.id === entry.id ? { ...e, quantity: updated.quantity } : e));
    } finally {
      setUpdating(null);
    }
  };

  const lightboxPrev = useCallback(() => setLightboxIdx((i) => (i !== null && i > 0 ? i - 1 : i)), []);
  const lightboxNext = useCallback(() => setLightboxIdx((i) => (i !== null && i < filtered.length - 1 ? i + 1 : i)), [filtered.length]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  lightboxPrev();
      if (e.key === 'ArrowRight') lightboxNext();
      if (e.key === 'Escape')     setLightboxIdx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, lightboxPrev, lightboxNext]);

  const totalCards = entries.reduce((s, e) => s + e.quantity, 0);
  const byRarity = entries.reduce<Record<string, number>>((acc, e) => {
    const r = e.rarity?.toUpperCase() ?? 'COMMON';
    acc[r] = (acc[r] ?? 0) + e.quantity;
    return acc;
  }, {});
  const byFaction = entries.reduce<Record<string, number>>((acc, e) => {
    if (e.faction) acc[e.faction] = (acc[e.faction] ?? 0) + e.quantity;
    return acc;
  }, {});
  void byFaction;

  const ownedSets = useMemo(
    () => new Set(entries.map((e) => e.cardSet).filter(Boolean)),
    [entries],
  );
  const allSets = Object.keys(SET_NAMES);

  const rarityLabel = (r: string) => t(`rarity${r.charAt(0) + r.slice(1).toLowerCase()}` as Parameters<typeof t>[0]);

  const toggleFilter = <T extends string>(list: T[], setList: (v: T[]) => void, value: T) => {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
    setPage(1);
  };

  const hasFilters = !!(search || filterFactions.length || filterRarities.length || filterSets.length || filterTypes.length);

  const exportCsv = () => {
    const rows = [
      ['cardReference', 'name', 'quantity', 'rarity', 'faction', 'cardSet', 'isFoil'],
      ...entries.map((e) => [
        e.cardReference,
        e.name ?? '',
        String(e.quantity),
        e.rarity ?? '',
        e.faction ?? '',
        e.cardSet ?? '',
        e.isFoil ? '1' : '0',
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSearch('');
    setFilterFactions([]);
    setFilterRarities([]);
    setFilterSets([]);
    setFilterTypes([]);
    setPage(1);
  };

  return (
    <SiteLayout>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="section-title mb-0">
            <i className="fa-solid fa-boxes-stacked mr-2" />
            {t('title')}
            {totalCards > 0 && (
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--neutral-600)' }}>
                {t('totalCards', { count: totalCards })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button onClick={exportCsv} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-c-border text-xs text-c-text-muted hover:text-c-text hover:border-c-text/50 transition">
                <i className="fa-solid fa-file-arrow-down" />
                Export CSV
              </button>
            )}
            <Link href="/collection/import/csv" className="btn-primary-altered btn-sm">
              <i className="fa-solid fa-file-csv" />
              {t('importCsv')}
            </Link>
          </div>
        </div>

        {(authLoading || (!isAuthenticated && USE_KEYCLOAK)) && (
          <div className="flex items-center justify-center h-64 gap-3 text-c-text-muted">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-400" />
            <span className="text-sm">{authLoading ? tc('loading') : 'Redirection...'}</span>
          </div>
        )}

        {!authLoading && !isAuthenticated && !USE_KEYCLOAK && (
          <div className="text-center mt-20 flex flex-col items-center gap-4">
            <p className="text-c-text-muted">{t('loginRequired')}</p>
            <LoginButton />
          </div>
        )}

        {isAuthenticated && loading && (
          <p className="text-sm text-c-text-muted">{tc('loading')}</p>
        )}
        {isAuthenticated && error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {isAuthenticated && !loading && !error && entries.length === 0 && (
          <div className="text-center mt-20 flex flex-col items-center gap-4">
            <p className="text-c-text-muted">{t('empty')}</p>
            <Link href="/collection/import/csv" className="btn-primary-altered">
              <i className="fa-solid fa-file-csv" />
              {t('importFromAltered')}
            </Link>
          </div>
        )}

        {entries.length > 0 && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {RARITY_ORDER.filter((r) => byRarity[r]).map((r) => (
                <div key={r} className="card-altered p-4 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://alteredcore.org/assets/gems/${GEM_KEYS[r]}.png`} alt={r} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                  <div>
                    <p className="text-lg font-bold text-c-text">{byRarity[r]}</p>
                    <p className="text-xs text-c-text-muted">{rarityLabel(r)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Filter bar ── */}
            <div className="card-altered p-4 flex flex-col gap-3">

              {/* Search + reset */}
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-c-text-muted text-xs" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('filterSearch')}
                    className="w-full bg-c-input border border-c-border rounded-lg pl-8 pr-3 py-2 text-sm text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                {hasFilters && (
                  <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-c-border text-sm text-c-text-muted hover:text-c-text hover:border-c-text transition whitespace-nowrap">
                    <i className="fa-solid fa-rotate-left text-xs" />
                    {t('filterReset')}
                  </button>
                )}
              </div>

              {/* Sets */}
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${allSets.length}, minmax(0, 1fr))` }}>
                {allSets.map((s) => {
                  const active = filterSets.includes(s);
                  const owned = ownedSets.has(s);
                  const setName = SET_NAMES[s]?.[locale as 'fr' | 'en'] ?? s;
                  return (
                    <button
                      key={s}
                      onClick={() => toggleFilter(filterSets, setFilterSets, s)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square ${active ? 'border-amber-400 ring-1 ring-amber-400' : 'border-transparent hover:border-c-border'} ${!owned ? 'opacity-40 grayscale' : 'opacity-90 hover:opacity-100'}`}
                      title={setName}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/sets/${s}.webp`} alt={setName} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/70" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1">
                        {SET_ICONS[s] && <i className={`${SET_ICONS[s]} text-white text-3xl drop-shadow`} />}
                        <span className="text-sm font-semibold text-white leading-tight text-center drop-shadow">{setName}</span>
                      </div>
                      {active && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                          <i className="fa-solid fa-check text-[7px] text-black" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Factions */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(FACTIONS).map(([code, name]) => {
                  const active = filterFactions.includes(code);
                  return (
                    <button
                      key={code}
                      onClick={() => toggleFilter(filterFactions, setFilterFactions, code)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${active ? 'border-amber-400 bg-amber-400/15 text-amber-400' : 'border-c-border text-c-text-muted hover:text-c-text hover:border-c-text/50'}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://alteredcore.org/assets/faction/${code}.png`} alt={code} style={{ width: 15, height: 15, objectFit: 'contain' }} />
                      {name}
                    </button>
                  );
                })}
              </div>

              {/* Rarities */}
              <div className="flex flex-wrap gap-2">
                {RARITY_ORDER.map((r) => {
                  const active = filterRarities.includes(r);
                  return (
                    <button
                      key={r}
                      onClick={() => toggleFilter(filterRarities, setFilterRarities, r)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${active ? 'border-amber-400 bg-amber-400/15 text-amber-400' : 'border-c-border text-c-text-muted hover:text-c-text hover:border-c-text/50'}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`https://alteredcore.org/assets/gems/${GEM_KEYS[r]}.png`} alt={r} style={{ width: 15, height: 15, objectFit: 'contain' }} />
                      {rarityLabel(r)}
                    </button>
                  );
                })}
              </div>

              {/* Types */}
              <div className="flex flex-wrap gap-2">
                {CARD_TYPES.map(({ value, label }) => {
                  const active = filterTypes.includes(value);
                  return (
                    <button
                      key={value}
                      onClick={() => toggleFilter(filterTypes, setFilterTypes, value)}
                      className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${active ? 'border-amber-400 bg-amber-400/15 text-amber-400' : 'border-c-border text-c-text-muted hover:text-c-text hover:border-c-text/50'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Count + grid size picker */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-c-text-muted">
                  {hasFilters ? t('filterCount', { count: filtered.length, total: entries.length }) : t('totalCards', { count: entries.length })}
                </p>
                <div className="flex items-center gap-1">
                  {([
                    { size: 'sm', icon: 'fa-table-cells', title: 'Petites' },
                    { size: 'md', icon: 'fa-border-all', title: 'Moyennes' },
                    { size: 'lg', icon: 'fa-table-cells-large', title: 'Grandes' },
                  ] as const).map(({ size, icon, title }) => (
                    <button
                      key={size}
                      onClick={() => setGridSize(size)}
                      className={`w-7 h-7 flex items-center justify-center rounded border transition-all text-xs ${gridSize === size ? 'border-amber-400 text-amber-400 bg-amber-400/10' : 'border-c-border text-c-text-muted hover:border-c-text/50 hover:text-c-text'}`}
                      title={title}
                    >
                      <i className={`fa-solid ${icon}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Card grid */}
            <div className="card-altered p-4">
              <div className={`grid gap-2 ${
                gridSize === 'sm' ? 'grid-cols-4 sm:grid-cols-8' : gridSize === 'md' ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-4'
              }`}>
                {filtered.slice(0, page * PAGE_SIZE).map((entry, idx) => {
                  const isUnique = getRarityFromSlug(entry.cardReference) === 'UNIQUE';
                  const imgUrl = isUnique ? null : getCdnImageUrl(entry.cardReference, locale);
                  const isBusy = deleting === entry.id || updating === entry.id;
                  return (
                    <div
                      key={entry.id}
                      className="relative group rounded-lg overflow-hidden border border-c-border bg-c-surface flex flex-col"
                    >
                      {/* Image */}
                      <div
                        onClick={() => setLightboxIdx(idx)}
                        className={`relative cursor-zoom-in ${!isUnique ? 'aspect-[744/1039]' : ''}`}
                      >
                        {isUnique ? (
                          <UniqueCardRenderer reference={entry.cardReference} locale={locale} className="w-full" />
                        ) : imgUrl ? (
                          <Image src={imgUrl} alt={entry.name ?? entry.cardReference} fill sizes="150px" className="object-cover" unoptimized />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center p-1">
                            <span className="text-[9px] text-c-text-muted text-center font-mono leading-tight">{entry.cardReference}</span>
                          </div>
                        )}

                        {entry.isFoil && (
                          <span className="absolute top-1 left-1 text-[9px] font-bold text-amber-300 bg-black/70 px-1 py-0.5 rounded z-10">
                            FOIL
                          </span>
                        )}

                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                          disabled={isBusy}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600/80 hover:bg-red-500 text-white rounded p-1 text-[10px] z-10"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>

                      {/* Quantité — sous la carte */}
                      <div className="flex items-center bg-c-elevated border-t border-c-border">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(entry, -1); }}
                          disabled={isBusy}
                          className="flex-1 py-2 flex items-center justify-center text-c-text-muted hover:bg-red-600 hover:text-white active:bg-red-700 transition-colors disabled:opacity-30 text-base font-bold"
                        >
                          −
                        </button>
                        <span className="text-sm font-bold text-amber-400 px-2 min-w-[32px] text-center">
                          {isBusy ? '…' : `×${entry.quantity}`}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(entry, +1); }}
                          disabled={isBusy || (isUnique && entry.quantity >= 1)}
                          className="flex-1 py-2 flex items-center justify-center text-c-text-muted hover:bg-green-600 hover:text-white active:bg-green-700 transition-colors disabled:opacity-30 text-base font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {filtered.length > page * PAGE_SIZE && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="px-5 py-2 rounded-lg border border-c-border text-sm text-c-text-muted hover:text-c-text hover:border-c-text/50 transition"
                  >
                    Afficher plus ({filtered.length - page * PAGE_SIZE} restantes)
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxIdx(null)}
        >
          <div
            className="relative flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxIdx(null)}
              className="absolute -top-3 -right-3 z-10 bg-c-surface border border-c-border rounded-full w-8 h-8 flex items-center justify-center text-c-text-muted hover:text-c-text transition"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>

            <div className="w-[320px] sm:w-[480px] md:w-[560px] rounded-2xl overflow-hidden shadow-2xl">
              {getRarityFromSlug(lightbox.cardReference) === 'UNIQUE' ? (
                <UniqueCardRenderer reference={lightbox.cardReference} locale={locale} className="w-full" />
              ) : (
                (() => {
                  const url = getCdnImageUrl(lightbox.cardReference, locale);
                  return url ? (
                    <div className="relative aspect-[744/1039]">
                      <Image src={url} alt={lightbox.name ?? lightbox.cardReference} fill sizes="360px" className="object-cover" unoptimized />
                    </div>
                  ) : (
                    <div className="aspect-[744/1039] flex items-center justify-center bg-c-surface">
                      <span className="text-xs text-c-text-muted font-mono">{lightbox.cardReference}</span>
                    </div>
                  );
                })()
              )}
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-c-text">{lightbox.name ?? lightbox.cardReference}</p>
              <p className="text-xs text-c-text-muted font-mono">{lightbox.cardReference}</p>
              <div className="flex items-center justify-center gap-3 mt-2">
                <button
                  onClick={() => handleUpdateQuantity(lightbox, -1)}
                  disabled={updating === lightbox.id || deleting === lightbox.id}
                  className="w-11 h-11 flex items-center justify-center rounded-full bg-c-input hover:bg-red-600 text-c-text hover:text-white transition disabled:opacity-30 text-xl font-bold"
                >
                  −
                </button>
                <span className="text-xl font-bold text-amber-400 min-w-[3rem] text-center">×{lightbox.quantity}</span>
                <button
                  onClick={() => handleUpdateQuantity(lightbox, +1)}
                  disabled={updating === lightbox.id || deleting === lightbox.id || (getRarityFromSlug(lightbox.cardReference) === 'UNIQUE' && lightbox.quantity >= 1)}
                  className="w-11 h-11 flex items-center justify-center rounded-full bg-c-input hover:bg-green-600 text-c-text hover:text-white transition disabled:opacity-30 text-xl font-bold"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-white/40 mt-1">{(lightboxIdx ?? 0) + 1} / {filtered.length}</p>
            </div>
          </div>

          {/* Prev */}
          <button
            onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
            disabled={lightboxIdx === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white disabled:opacity-20 transition"
          >
            <i className="fa-solid fa-chevron-left text-base" />
          </button>

          {/* Next */}
          <button
            onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
            disabled={lightboxIdx === filtered.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white disabled:opacity-20 transition"
          >
            <i className="fa-solid fa-chevron-right text-base" />
          </button>
        </div>
      )}
    </SiteLayout>
  );
}
