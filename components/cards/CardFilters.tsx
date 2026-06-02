'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { fetchSets, fetchFactions, fetchKeywords, fetchTriggers, fetchEffects, fetchConditions, fetchSlotFacets } from '@/lib/api/cardApi';
import { FACTIONS, CARD_TYPES, RARITIES } from '@/lib/types/constants';
import type { CardGroupFilters, EffectSlot } from '@/lib/types/card';
import MultiSelect from '@/components/ui/MultiSelect';
import SingleSelect from '@/components/ui/SingleSelect';

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

const toArr = <T,>(v: T | T[] | undefined): T[] =>
  Array.isArray(v) ? v : v ? [v] : [];

function Tooltip({ text }: { text: string }) {
  return (
    <div className="relative group/tooltip flex-shrink-0">
      <button
        type="button"
        tabIndex={-1}
        className="w-3.5 h-3.5 rounded-full bg-c-border text-[9px] text-c-text-muted flex items-center justify-center hover:bg-blue-500 hover:text-white transition cursor-help"
      >
        ?
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 p-2 bg-c-elevated border border-c-border rounded-md text-[10px] text-c-text-secondary leading-relaxed opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

interface EffectSlotRowProps {
  slot: EffectSlot;
  index: number;
  allTriggers: { value: string; label: string }[];
  allConditions: { value: string; label: string }[];
  allEffects: { value: string; label: string }[];
  onUpdate: (partial: Partial<EffectSlot>) => void;
  onRemove: () => void;
  t: (key: string) => string;
}

function EffectSlotRow({ slot, index, allTriggers, allConditions, allEffects, onUpdate, onRemove, t }: EffectSlotRowProps) {
  const triggerId   = slot.trigger   ?? '';
  const conditionId = slot.condition ?? '';
  const effectId    = slot.output    ?? '';

  const { data: facets } = useQuery({
    queryKey: ['slot-facets', triggerId, conditionId, effectId],
    queryFn:  () => fetchSlotFacets(triggerId || undefined, conditionId || undefined, effectId || undefined),
    enabled:  !!triggerId || !!conditionId || !!effectId,
    staleTime: Infinity,
  });

  const filterByFacet = (all: { value: string; label: string }[], facet?: Record<string, number>) => {
    if (!facet || !Object.keys(facet).length) return all;
    return all.filter((o) => o.value in facet);
  };

  const hasContext = !!triggerId || !!conditionId || !!effectId;
  const triggerOptions   = hasContext && !triggerId   ? filterByFacet(allTriggers,   facets?.triggers)   : allTriggers;
  const conditionOptions = hasContext && !conditionId ? filterByFacet(allConditions,  facets?.conditions) : allConditions;
  const effectOptions    = hasContext && !effectId    ? filterByFacet(allEffects,     facets?.effects)    : allEffects;

  const singleId = (facet?: Record<string, number>) => {
    const keys = Object.keys(facet ?? {});
    return keys.length === 1 ? keys[0] : undefined;
  };

  const handleChange = async (field: keyof EffectSlot, value: string) => {
    const partial: Partial<EffectSlot> = { [field]: value || undefined };

    if (value) {
      if (field === 'trigger') {
        const f = await fetchSlotFacets(value, conditionId || undefined);
        if (!slot.condition) {
          const prefillCond = singleId(f.conditions);
          if (prefillCond) {
            partial.condition = prefillCond;
            if (!slot.output) {
              const f2 = await fetchSlotFacets(value, prefillCond);
              const p = singleId(f2.effects); if (p) partial.output = p;
            }
          } else if (!slot.output) {
            const p = singleId(f.effects); if (p) partial.output = p;
          }
        } else if (!slot.output) {
          const f2 = await fetchSlotFacets(value, conditionId);
          const p = singleId(f2.effects); if (p) partial.output = p;
        }
      }

      if (field === 'condition') {
        if (!slot.trigger) {
          const f = await fetchSlotFacets(undefined, value);
          const prefillTrigger = singleId(f.triggers);
          if (prefillTrigger) partial.trigger = prefillTrigger;
          if (!slot.output) {
            const f2 = await fetchSlotFacets(prefillTrigger ?? undefined, value);
            const p = singleId(f2.effects); if (p) partial.output = p;
          }
        } else if (!slot.output) {
          const f = await fetchSlotFacets(triggerId, value);
          const p = singleId(f.effects); if (p) partial.output = p;
        }
      }

      if (field === 'output') {
        if (!slot.trigger && !slot.condition) {
          const f = await fetchSlotFacets(undefined, undefined, value);
          const prefillTrigger = singleId(f.triggers);
          if (prefillTrigger) {
            partial.trigger = prefillTrigger;
            const f2 = await fetchSlotFacets(prefillTrigger, undefined, value);
            const prefillCond = singleId(f2.conditions);
            if (prefillCond) partial.condition = prefillCond;
          } else {
            const prefillCond = singleId(f.conditions);
            if (prefillCond) partial.condition = prefillCond;
          }
        } else if (!slot.trigger) {
          const f = await fetchSlotFacets(undefined, conditionId, value);
          const p = singleId(f.triggers); if (p) partial.trigger = p;
        } else if (!slot.condition) {
          const f = await fetchSlotFacets(triggerId, undefined, value);
          const p = singleId(f.conditions); if (p) partial.condition = p;
        }
      }
    }

    onUpdate(partial);
  };

  return (
    <div className="border border-c-border rounded-md p-2 flex flex-col gap-2 bg-c-surface">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-c-text-secondary">Effect [{index}]</span>
        <button type="button" onClick={onRemove} className="text-xs text-c-text-subtle hover:text-red-400 transition">
          {t('effectRemove')}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([
          { field: 'trigger'   as const, options: triggerOptions,   label: t('effectTriggerLabel'),   value: triggerId   },
          { field: 'condition' as const, options: conditionOptions,  label: t('effectConditionLabel'), value: conditionId },
          { field: 'output'    as const, options: effectOptions,     label: t('effectOutputLabel'),    value: effectId    },
        ]).map(({ field, options, label, value }) => (
          <div key={field} className="flex flex-col gap-1">
            <span className="text-[10px] text-c-text-muted">{label}</span>
            <SingleSelect
              options={options}
              value={value}
              onChange={(v) => handleChange(field, v)}
              placeholder={label}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CardFiltersPanel({ filters, onChange, onReset, selectedRarities = [], onToggleRarity, excludeTypes = [], showOnlyOwned = false, onToggleOwned, isAuthenticated = false }: CardFiltersProps) {
  const t = useTranslations('cards');
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<'general' | 'effects'>('general');

  const { data: sets = [] }       = useQuery({ queryKey: ['sets'],              queryFn: fetchSets,                              staleTime: Infinity });
  const { data: apiFactions = [] } = useQuery({ queryKey: ['factions'],          queryFn: fetchFactions,                          staleTime: Infinity });
  const { data: keywords = [] }   = useQuery({ queryKey: ['keywords', locale],  queryFn: () => fetchKeywords(locale),            staleTime: Infinity });
  const { data: triggers = [] }   = useQuery({ queryKey: ['triggers'],           queryFn: fetchTriggers,                          staleTime: Infinity });
  const { data: conditions = [] } = useQuery({ queryKey: ['conditions'],         queryFn: fetchConditions,                        staleTime: Infinity });
  const { data: effects = [] }    = useQuery({ queryKey: ['effects'],            queryFn: fetchEffects,                           staleTime: Infinity });

  const factions = apiFactions.length > 0
    ? apiFactions.map((f) => ({ code: f.code, name: FACTIONS[f.code] ?? f.name }))
    : Object.entries(FACTIONS).map(([code, name]) => ({ code, name }));

  const update = (key: keyof CardGroupFilters, value: string) =>
    onChange({ ...filters, [key]: value || undefined, page: 1 });

  const updateMulti = (key: keyof CardGroupFilters, values: string[]) =>
    onChange({ ...filters, [key]: values.length ? values : undefined, page: 1 });

  const selectedFactions = toArr(filters.faction);
  const matchesFaction = (itemFactions: string[]) =>
    selectedFactions.length === 0 || itemFactions.length === 0 || itemFactions.some((f) => selectedFactions.includes(f));
  const toOption = (item: { alteredId: number; factions: string[]; translations: Record<string, string> }) => ({
    value: String(item.alteredId),
    label: item.translations[locale] ?? item.translations['en'] ?? String(item.alteredId),
  });
  const sortOpts = (opts: { value: string; label: string }[]) => opts.sort((a, b) => a.label.localeCompare(b.label, locale));
  const byFaction = (item: { factions: string[] }) => matchesFaction(item.factions);

  const mainTriggerOptions   = sortOpts(triggers.filter((t) => t.isMain    && byFaction(t)).map(toOption));
  const mainConditionOptions = sortOpts(conditions.filter((c) => c.isMain   && byFaction(c)).map(toOption));
  const mainEffectOptions    = sortOpts(effects.filter((e) => e.isMain      && byFaction(e)).map(toOption));
  const supportTriggerOptions   = sortOpts(triggers.filter((t) => t.isSupport  && byFaction(t)).map(toOption));
  const supportConditionOptions = sortOpts(conditions.filter((c) => c.isSupport && byFaction(c)).map(toOption));
  const supportEffectOptions    = sortOpts(effects.filter((e) => e.isSupport   && byFaction(e)).map(toOption));

  const slots        = filters.effectSlots        ?? [];
  const supportSlots = filters.supportEffectSlots ?? [];

  const makeSlotActions = (key: 'effectSlots' | 'supportEffectSlots', current: EffectSlot[]) => ({
    add: () => onChange({ ...filters, [key]: [...current, {}], page: 1 }),
    remove: (i: number) => {
      const next = current.filter((_, idx) => idx !== i);
      const extra = key === 'effectSlots' && next.length <= 1 ? { effectSlotsOperator: undefined } : {};
      onChange({ ...filters, [key]: next.length ? next : undefined, ...extra, page: 1 });
    },
    update: (i: number, partial: Partial<EffectSlot>) => {
      const next = current.map((s, idx) => {
        if (idx !== i) return s;
        const updated = { ...s };
        for (const [k, v] of Object.entries(partial)) {
          if (v) updated[k as keyof EffectSlot] = v;
          else delete updated[k as keyof EffectSlot];
        }
        return updated;
      });
      onChange({ ...filters, [key]: next, page: 1 });
    },
  });

  const mainSlot    = makeSlotActions('effectSlots',        slots);
  const supportSlot = makeSlotActions('supportEffectSlots', supportSlots);

  const hasActiveEffects =
    slots.some(s => s.trigger || s.condition || s.output) ||
    supportSlots.some(s => s.trigger || s.condition || s.output) ||
    filters.effectSupport !== undefined;

  const IGNORED_KEYS = new Set(['page', 'effectSlots', 'effectSlotsOperator', 'supportEffectSlots', 'effectSupport', 'order[collectorNumberFormatedId]']);
  const hasActiveGeneral =
    Object.entries(filters).some(([k, v]) => !IGNORED_KEYS.has(k) && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) ||
    showOnlyOwned;

  const hasActiveFilters = hasActiveGeneral || hasActiveEffects;
  const totalSlots = slots.length + supportSlots.length;

  const selectClass = 'px-2 py-1.5 bg-c-input border border-c-border rounded-md text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500';
  const inputClass  = 'px-2 py-1.5 bg-c-input border border-c-border rounded-md text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-full';

  return (
    <div className="flex flex-col gap-2 p-3 bg-c-elevated rounded-lg">

      {/* Onglets */}
      <div className="flex gap-0.5 border-b border-c-border pb-2">
        {(['general', 'effects'] as const).map((tab) => {
          const active = tab === 'general' ? hasActiveGeneral : hasActiveEffects;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition select-none
                ${activeTab === tab ? 'bg-c-input text-c-text' : 'text-c-text-muted hover:text-c-text'}`}
            >
              {t(tab === 'general' ? 'tabGeneral' : 'tabEffects')}
              {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
            </button>
          );
        })}
      </div>

      {/* ── Onglet Général ── */}
      {activeTab === 'general' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={filters.reference ?? ''}
              onChange={(e) => update('reference', e.target.value)}
              placeholder={t('searchReference')}
              className="px-2 py-1.5 bg-c-input border border-c-border rounded-md text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-36 shrink-0"
            />
            <input
              type="text"
              value={filters.name ?? ''}
              onChange={(e) => update('name', e.target.value)}
              placeholder={t('search')}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MultiSelect
              options={CARD_TYPES.filter((type) => !excludeTypes.includes(type.value)).map((type) => ({ value: type.value, label: type.label }))}
              value={toArr(filters.cardType)}
              onChange={(vals) => updateMulti('cardType', vals)}
              placeholder={t('allTypes')}
            />
            <MultiSelect
              options={factions.map(({ code, name }) => ({ value: code, label: name }))}
              value={toArr(filters.faction)}
              onChange={(vals) => updateMulti('faction', vals)}
              placeholder={t('allFactions')}
            />
            <MultiSelect
              options={sets.map((s) => ({ value: s.reference, label: s.name }))}
              value={toArr(filters['set.reference'])}
              onChange={(vals) => updateMulti('set.reference', vals)}
              placeholder={t('allSets')}
            />
            <MultiSelect
              options={keywords.map((k) => ({ value: k.code, label: k.translations[locale] ?? k.translations['en'] ?? k.code })).sort((a, b) => a.label.localeCompare(b.label, locale))}
              value={toArr(filters.effectKeyword)}
              onChange={(vals) => updateMulti('effectKeyword', vals)}
              placeholder={t('allKeywords')}
            />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <select value={filters.costComparison ?? ''} onChange={(e) => update('costComparison', e.target.value)} className={selectClass}>
              <option value="">{t('costComparison')}</option>
              <option value="equal">{t('costEqual')}</option>
              <option value="mainHigher">{t('costMainHigher')}</option>
              <option value="recallHigher">{t('costRecallHigher')}</option>
            </select>
            {(['mainCost', 'recallCost', 'oceanPower', 'mountainPower', 'forestPower'] as const).map((field) => (
              <div key={field} className="flex items-center gap-1">
                <input
                  type="text"
                  value={filters[field] ?? ''}
                  onChange={(e) => update(field, e.target.value)}
                  placeholder={t(field)}
                  className={inputClass}
                />
                <Tooltip text={t('costInputTooltip')} />
              </div>
            ))}
          </div>

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
                  <input type="checkbox" checked={showOnlyOwned} onChange={onToggleOwned} className="w-3.5 h-3.5 accent-amber-500" />
                  <span className="text-xs text-amber-400 font-medium">{t('ownedOnly')}</span>
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Onglet Effets ── */}
      {activeTab === 'effects' && (
        <div className="flex flex-col gap-3">

          {totalSlots > 1 && (
            <div className="flex items-center gap-1 ml-auto">
              <Tooltip text={t('effectOperatorTooltip')} />
              <span className="text-xs text-c-text-muted">{t('effectOperator')}</span>
              {(['AND', 'OR'] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => onChange({ ...filters, effectSlotsOperator: op, page: 1 })}
                  className={`px-2 py-0.5 rounded text-xs font-semibold transition ${
                    (filters.effectSlotsOperator ?? 'AND') === op
                      ? 'bg-blue-500 text-white'
                      : 'bg-c-input text-c-text-muted hover:text-c-text'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          )}

          {([
            { label: t('effectMainHeader'),    slots: slots,        actions: mainSlot,    allT: mainTriggerOptions,    allC: mainConditionOptions,    allE: mainEffectOptions    },
            { label: t('effectSupportHeader'), slots: supportSlots, actions: supportSlot, allT: supportTriggerOptions, allC: supportConditionOptions, allE: supportEffectOptions },
          ]).map(({ label, slots: sectionSlots, actions, allT, allC, allE }) => (
            <div key={label} className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">{label}</span>
              {sectionSlots.map((slot, i) => (
                <EffectSlotRow
                  key={i}
                  slot={slot}
                  index={i}
                  allTriggers={allT}
                  allConditions={allC}
                  allEffects={allE}
                  onUpdate={(partial) => actions.update(i, partial)}
                  onRemove={() => actions.remove(i)}
                  t={t}
                />
              ))}
              <button
                type="button"
                onClick={actions.add}
                className="border border-dashed border-c-border rounded-md py-1.5 text-xs text-c-text-muted hover:text-c-text hover:border-c-text-muted transition text-center"
              >
                + {t('effectAddSlot')}
              </button>
            </div>
          ))}

        </div>
      )}

      {hasActiveFilters && (
        <button onClick={onReset} className="text-xs text-c-text-subtle hover:text-c-text underline text-left">
          {t('resetFilters')}
        </button>
      )}
    </div>
  );
}
