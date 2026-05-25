'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { fetchSets, fetchFactions, fetchKeywords } from '@/lib/api/cardApi';
import { FACTIONS, CARD_TYPES, RARITIES } from '@/lib/types/constants';
import type { CardGroupFilters } from '@/lib/types/card';
import MultiSelect from '@/components/ui/MultiSelect';

interface CardFiltersProps {
  filters: CardGroupFilters;
  onChange: (filters: CardGroupFilters) => void;
  onReset?: () => void;
  selectedRarities?: string[];
  onToggleRarity?: (ref: string) => void;
  excludeTypes?: string[];
  showOnlyOwned?: boolean;
  onToggleOwned?: () => void;
  isAuthenticated?: boolean;
}

const COSTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];

export default function CardFiltersPanel({ filters, onChange, onReset, selectedRarities = [], onToggleRarity, excludeTypes = [], showOnlyOwned = false, onToggleOwned, isAuthenticated = false }: CardFiltersProps) {
  const t = useTranslations('cards');
  const locale = useLocale();

  const { data: sets = [] } = useQuery({
    queryKey: ['sets'],
    queryFn: fetchSets,
    staleTime: Infinity,
  });

  const { data: apiFactions = [] } = useQuery({
    queryKey: ['factions'],
    queryFn: fetchFactions,
    staleTime: Infinity,
  });

  const { data: keywords = [] } = useQuery({
    queryKey: ['keywords', locale],
    queryFn: () => fetchKeywords(locale),
    staleTime: Infinity,
  });

  const factions =
    apiFactions.length > 0
      ? apiFactions.map((f) => ({ code: f.code, name: f.name }))
      : Object.entries(FACTIONS).map(([code, name]) => ({ code, name }));

  const update = (key: keyof CardGroupFilters, value: string) => {
    onChange({ ...filters, [key]: value || undefined, page: 1 });
  };

  const updateMulti = (key: keyof CardGroupFilters, values: string[]) => {
    onChange({ ...filters, [key]: values.length ? values : undefined, page: 1 });
  };

  const hasActiveFilters = Object.entries(filters).some(
    ([k, v]) => k !== 'page' && v !== undefined && v !== ''
  );

  const selectClass = 'px-2 py-1.5 bg-c-input border border-c-border rounded-md text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500';
  const inputClass = 'px-2 py-1.5 bg-c-input border border-c-border rounded-md text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-full';

  return (
    <div className="flex flex-col gap-2 p-3 bg-c-elevated rounded-lg">
      {/* Recherche */}
      <input
        type="text"
        value={filters.name ?? ''}
        onChange={(e) => update('name', e.target.value)}
        placeholder={t('search')}
        className={inputClass}
      />

      {/* Ligne 1 : Type · Faction · Set · Keyword */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MultiSelect
          options={CARD_TYPES.filter((type) => !excludeTypes.includes(type.value)).map((type) => ({ value: type.value, label: type.label }))}
          value={Array.isArray(filters.cardType) ? filters.cardType : (filters.cardType ? [filters.cardType] : [])}
          onChange={(vals) => updateMulti('cardType', vals)}
          placeholder={t('allTypes')}
        />
        <MultiSelect
          options={factions.map(({ code, name }) => ({ value: code, label: name }))}
          value={Array.isArray(filters.faction) ? filters.faction : (filters.faction ? [filters.faction] : [])}
          onChange={(vals) => updateMulti('faction', vals)}
          placeholder={t('allFactions')}
        />
        <MultiSelect
          options={sets.map((s) => ({ value: s.reference, label: s.name }))}
          value={Array.isArray(filters['set.reference']) ? filters['set.reference'] : (filters['set.reference'] ? [filters['set.reference']] : [])}
          onChange={(vals) => updateMulti('set.reference', vals)}
          placeholder={t('allSets')}
        />
        <MultiSelect
          options={keywords.map((k) => ({ value: k.code, label: k.translations[locale] ?? k.translations['en'] ?? k.code })).sort((a, b) => a.label.localeCompare(b.label, locale))}
          value={Array.isArray(filters.effectKeyword) ? filters.effectKeyword : (filters.effectKeyword ? [filters.effectKeyword] : [])}
          onChange={(vals) => updateMulti('effectKeyword', vals)}
          placeholder={t('allKeywords')}
        />
      </div>

      {/* Ligne 2 : Coût main · Réserve · Mer · Montagne · Forêt */}
      <div className="grid grid-cols-5 gap-2">
        <select value={filters.mainCost ?? ''} onChange={(e) => update('mainCost', e.target.value)} className={selectClass}>
          <option value="">{t('mainCost')}</option>
          {COSTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filters.recallCost ?? ''} onChange={(e) => update('recallCost', e.target.value)} className={selectClass}>
          <option value="">{t('recallCost')}</option>
          {COSTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filters.oceanPower ?? ''} onChange={(e) => update('oceanPower', e.target.value)} className={selectClass}>
          <option value="">{t('oceanPower')}</option>
          {COSTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filters.mountainPower ?? ''} onChange={(e) => update('mountainPower', e.target.value)} className={selectClass}>
          <option value="">{t('mountainPower')}</option>
          {COSTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filters.forestPower ?? ''} onChange={(e) => update('forestPower', e.target.value)} className={selectClass}>
          <option value="">{t('forestPower')}</option>
          {COSTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Ligne 3 : Rareté (multi-select) + filtre collection */}
      <div className="flex items-center gap-3 flex-wrap">
        {RARITIES.map((r) => (
          <label key={r.value} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedRarities.includes(r.value)}
              onChange={() => onToggleRarity?.(r.value)}
              className="w-3.5 h-3.5 accent-blue-500"
            />
            <span className="text-xs text-c-text-secondary">{t(`rarities.${r.value}`)}</span>
          </label>
        ))}
        {isAuthenticated && (
          <>
            <span className="text-c-border-subtle">|</span>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showOnlyOwned}
                onChange={onToggleOwned}
                className="w-3.5 h-3.5 accent-amber-500"
              />
              <span className="text-xs text-amber-400 font-medium">{t('ownedOnly')}</span>
            </label>
          </>
        )}
      </div>

      {hasActiveFilters && (
        <button
          onClick={onReset}
          className="text-xs text-c-text-subtle hover:text-c-text underline text-left"
        >
          {t('resetFilters')}
        </button>
      )}
    </div>
  );
}
