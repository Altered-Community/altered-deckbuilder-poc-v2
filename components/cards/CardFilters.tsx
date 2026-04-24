'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { fetchSets, fetchFactions } from '@/lib/api/cardApi';
import { FACTIONS, CARD_TYPES } from '@/lib/types/constants';
import type { CardGroupFilters } from '@/lib/types/card';

interface CardFiltersProps {
  filters: CardGroupFilters;
  onChange: (filters: CardGroupFilters) => void;
  onReset?: () => void;
}

const COSTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];

export default function CardFiltersPanel({ filters, onChange, onReset }: CardFiltersProps) {
  const t = useTranslations('cards');

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

  const factions =
    apiFactions.length > 0
      ? apiFactions.map((f) => ({ code: f.code, name: f.name }))
      : Object.entries(FACTIONS).map(([code, name]) => ({ code, name }));

  const update = (key: keyof CardGroupFilters, value: string) => {
    onChange({ ...filters, [key]: value || undefined, page: 1 });
  };

  const hasActiveFilters = Object.entries(filters).some(
    ([k, v]) => k !== 'page' && v !== undefined && v !== ''
  );

  const selectClass = 'px-2 py-1.5 bg-c-input border border-c-border rounded-md text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500';
  const inputClass = 'px-2 py-1.5 bg-c-input border border-c-border rounded-md text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-full';

  return (
    <div className="flex flex-col gap-2 p-3 bg-c-elevated rounded-lg">
      <input
        type="text"
        value={filters.name ?? ''}
        onChange={(e) => update('name', e.target.value)}
        placeholder={t('search')}
        className={inputClass}
      />

      <div className="grid grid-cols-2 gap-2">
        <select value={filters.cardType ?? ''} onChange={(e) => update('cardType', e.target.value)} className={selectClass}>
          <option value="">{t('allTypes')}</option>
          {CARD_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>

        <select value={filters['faction.code'] ?? ''} onChange={(e) => update('faction.code', e.target.value)} className={selectClass}>
          <option value="">{t('allFactions')}</option>
          {factions.map(({ code, name }) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </div>

      <select value={filters['cards.set.reference'] ?? ''} onChange={(e) => update('cards.set.reference', e.target.value)} className={selectClass}>
        <option value="">{t('allSets')}</option>
        {sets.map((s) => (
          <option key={s.reference} value={s.reference}>{s.name}</option>
        ))}
      </select>

      <div className="grid grid-cols-3 gap-2">
        <select value={filters.mainCost ?? ''} onChange={(e) => update('mainCost', e.target.value)} className={selectClass}>
          <option value="">{t('mainCost')}</option>
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

        <select value={filters.forestPower ?? ''} onChange={(e) => update('forestPower', e.target.value)} className={`${selectClass} col-span-3`}>
          <option value="">{t('forestPower')}</option>
          {COSTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
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
