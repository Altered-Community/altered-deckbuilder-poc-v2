'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { fetchSets, fetchFactions, fetchKeywords, fetchTriggers, fetchEffects, fetchConditions, fetchEffectChainConditions, fetchEffectChainEffects, fetchEffectChainTriggers } from '@/lib/api/cardApi';
import type { EffectChainItem } from '@/lib/types/card';
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

const COSTS = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];

interface EffectSlotRowProps {
  slot: EffectSlot;
  index: number;
  allTriggers: { value: string; label: string }[];
  allConditions: { value: string; label: string }[];
  allEffects: { value: string; label: string }[];
  locale: string;
  onUpdate: (partial: Partial<EffectSlot>) => void;
  onRemove: () => void;
  t: (key: string) => string;
}

function EffectSlotRow({ slot, index, allTriggers, allConditions, allEffects, locale, onUpdate, onRemove, t }: EffectSlotRowProps) {
  const triggerId = slot.trigger ?? '';
  const conditionId = slot.condition ?? '';
  const effectId = slot.output ?? '';

  const chainToOption = (item: EffectChainItem) => ({
    value: String(item.id),
    label: (locale === 'fr' ? item.fr : item.en) ?? item.fr ?? item.en ?? String(item.id),
  });
  const sortOpts = (opts: { value: string; label: string }[]) =>
    opts.sort((a, b) => a.label.localeCompare(b.label, locale));

  // Filtering queries: narrow options based on what's already selected
  const { data: chainTriggers } = useQuery({
    queryKey: ['effect-chain-triggers', effectId, conditionId],
    queryFn: () => fetchEffectChainTriggers(effectId || undefined, conditionId || undefined),
    enabled: (!!effectId || !!conditionId) && !triggerId,
    staleTime: Infinity,
  });

  const { data: chainConditions } = useQuery({
    queryKey: ['effect-chain-conditions', triggerId, effectId],
    queryFn: () => fetchEffectChainConditions(triggerId || undefined, effectId || undefined),
    enabled: !!triggerId || !!effectId,
    staleTime: Infinity,
  });

  const { data: chainEffects } = useQuery({
    queryKey: ['effect-chain-effects', triggerId, conditionId],
    queryFn: () => fetchEffectChainEffects(triggerId || undefined, conditionId || undefined),
    enabled: (!!triggerId || !!conditionId) && !effectId,
    staleTime: Infinity,
  });

  const triggerOptions   = chainTriggers   ? sortOpts(chainTriggers.map(chainToOption))   : allTriggers;
  const conditionOptions = chainConditions ? sortOpts(chainConditions.map(chainToOption)) : allConditions;
  const effectOptions    = chainEffects    ? sortOpts(chainEffects.map(chainToOption))    : allEffects;

  const autoId = (items: EffectChainItem[]) =>
    items.length === 1 ? String(items[0].id) : undefined;

  const handleChange = async (field: keyof EffectSlot, value: string) => {
    const partial: Partial<EffectSlot> = { [field]: value || undefined };

    if (value) {
      if (field === 'trigger') {
        if (!slot.output) {
          const effects = await fetchEffectChainEffects(value, conditionId || undefined);
          const prefillOutput = autoId(effects);
          if (prefillOutput) partial.output = prefillOutput;
          if (!slot.condition) {
            const conds = await fetchEffectChainConditions(value, prefillOutput ?? undefined);
            const prefillCond = autoId(conds);
            if (prefillCond) partial.condition = prefillCond;
          }
        } else if (!slot.condition) {
          const conds = await fetchEffectChainConditions(value, slot.output);
          const prefillCond = autoId(conds);
          if (prefillCond) partial.condition = prefillCond;
        }
      }

      if (field === 'output') {
        if (!slot.trigger) {
          const trigs = await fetchEffectChainTriggers(value, conditionId || undefined);
          const prefillTrigger = autoId(trigs);
          if (prefillTrigger) partial.trigger = prefillTrigger;
          if (!slot.condition) {
            const conds = await fetchEffectChainConditions(prefillTrigger ?? undefined, value);
            const prefillCond = autoId(conds);
            if (prefillCond) partial.condition = prefillCond;
          }
        } else if (!slot.condition) {
          const conds = await fetchEffectChainConditions(slot.trigger, value);
          const prefillCond = autoId(conds);
          if (prefillCond) partial.condition = prefillCond;
        }
      }

      if (field === 'condition') {
        if (!slot.trigger) {
          const trigs = await fetchEffectChainTriggers(effectId || undefined, value);
          const prefillTrigger = autoId(trigs);
          if (prefillTrigger) partial.trigger = prefillTrigger;
        }
        if (!slot.output) {
          const effects = await fetchEffectChainEffects(triggerId || partial.trigger, value);
          const prefillOutput = autoId(effects);
          if (prefillOutput) partial.output = prefillOutput;
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
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-c-text-muted">{t('effectTriggerLabel')}</span>
          <SingleSelect
            options={triggerOptions}
            value={triggerId}
            onChange={(v) => handleChange('trigger', v)}
            placeholder={t('effectTriggerLabel')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-c-text-muted">{t('effectConditionLabel')}</span>
          <SingleSelect
            options={conditionOptions}
            value={conditionId}
            onChange={(v) => handleChange('condition', v)}
            placeholder={t('effectConditionLabel')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-c-text-muted">{t('effectOutputLabel')}</span>
          <SingleSelect
            options={effectOptions}
            value={effectId}
            onChange={(v) => handleChange('output', v)}
            placeholder={t('effectOutputLabel')}
          />
        </div>
      </div>
    </div>
  );
}

export default function CardFiltersPanel({ filters, onChange, onReset, selectedRarities = [], onToggleRarity, excludeTypes = [], showOnlyOwned = false, onToggleOwned, isAuthenticated = false }: CardFiltersProps) {
  const t = useTranslations('cards');
  const locale = useLocale();
  const [effectsOpen, setEffectsOpen] = useState(false);

  const { data: sets = [] } = useQuery({ queryKey: ['sets'], queryFn: fetchSets, staleTime: Infinity });
  const { data: apiFactions = [] } = useQuery({ queryKey: ['factions'], queryFn: fetchFactions, staleTime: Infinity });
  const { data: keywords = [] } = useQuery({ queryKey: ['keywords', locale], queryFn: () => fetchKeywords(locale), staleTime: Infinity });
  const { data: triggers = [] } = useQuery({ queryKey: ['triggers'], queryFn: fetchTriggers, staleTime: Infinity });
  const { data: conditions = [] } = useQuery({ queryKey: ['conditions'], queryFn: fetchConditions, staleTime: Infinity });
  const { data: effects = [] } = useQuery({ queryKey: ['effects'], queryFn: fetchEffects, staleTime: Infinity });

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

  const selectedFactions = Array.isArray(filters.faction) ? filters.faction : (filters.faction ? [filters.faction] : []);
  const matchesFaction = (itemFactions: string[]) =>
    selectedFactions.length === 0 || itemFactions.length === 0 || itemFactions.some((f) => selectedFactions.includes(f));
  const toOption = (item: { alteredId: number; factions: string[]; translations: Record<string, string> }) => ({
    value: String(item.alteredId),
    label: item.translations[locale] ?? item.translations['en'] ?? String(item.alteredId),
  });

  const sortOpts = (opts: { value: string; label: string }[]) => opts.sort((a, b) => a.label.localeCompare(b.label, locale));
  const byFaction = (item: { factions: string[] }) => matchesFaction(item.factions);

  const mainTriggerOptions   = sortOpts(triggers.filter((t) => t.isMain && byFaction(t)).map(toOption));
  const mainConditionOptions = sortOpts(conditions.filter((c) => c.isMain && byFaction(c)).map(toOption));
  const mainEffectOptions    = sortOpts(effects.filter((e) => e.isMain && byFaction(e)).map(toOption));

  const supportTriggerOptions   = sortOpts(triggers.filter((t) => t.isSupport && byFaction(t)).map(toOption));
  const supportConditionOptions = sortOpts(conditions.filter((c) => c.isSupport && byFaction(c)).map(toOption));
  const supportEffectOptions    = sortOpts(effects.filter((e) => e.isSupport && byFaction(e)).map(toOption));

  const slots = filters.effectSlots ?? [];
  const supportSlots = filters.supportEffectSlots ?? [];

  const makeSlotUpdater = (key: 'effectSlots' | 'supportEffectSlots', current: EffectSlot[]) =>
    (i: number, partial: Partial<EffectSlot>) => {
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
    };

  const addSlot = () =>
    onChange({ ...filters, effectSlots: [...slots, {}], page: 1 });

  const removeSlot = (i: number) => {
    const next = slots.filter((_, idx) => idx !== i);
    onChange({ ...filters, effectSlots: next.length ? next : undefined, effectSlotsOperator: next.length > 1 ? filters.effectSlotsOperator : undefined, page: 1 });
  };

  const updateSlot = makeSlotUpdater('effectSlots', slots);

  const addSupportSlot = () =>
    onChange({ ...filters, supportEffectSlots: [...supportSlots, {}], page: 1 });

  const removeSupportSlot = (i: number) => {
    const next = supportSlots.filter((_, idx) => idx !== i);
    onChange({ ...filters, supportEffectSlots: next.length ? next : undefined, page: 1 });
  };

  const updateSupportSlot = makeSlotUpdater('supportEffectSlots', supportSlots);

  const hasActiveEffects =
    slots.some(s => s.trigger || s.condition || s.output) ||
    supportSlots.some(s => s.trigger || s.condition || s.output) ||
    filters.effectSupport !== undefined;

  const totalSlots = slots.length + supportSlots.length;

  const hasActiveFilters =
    Object.entries(filters).some(([k, v]) => !['page', 'effectSlots', 'effectSlotsOperator', 'supportEffectSlots', 'effectSupport'].includes(k) && v !== undefined && v !== '') ||
    hasActiveEffects;

  const selectClass = 'px-2 py-1.5 bg-c-input border border-c-border rounded-md text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500';
  const inputClass = 'px-2 py-1.5 bg-c-input border border-c-border rounded-md text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-full';

  return (
    <div className="flex flex-col gap-2 p-3 bg-c-elevated rounded-lg">
      {/* Recherche */}
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

      {/* Ligne 2 : Gestion coûts · Coût main · Réserve · Mer · Montagne · Forêt */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <select value={filters.costComparison ?? ''} onChange={(e) => update('costComparison', e.target.value)} className={selectClass}>
          <option value="">{t('costComparison')}</option>
          <option value="equal">{t('costEqual')}</option>
          <option value="mainHigher">{t('costMainHigher')}</option>
          <option value="recallHigher">{t('costRecallHigher')}</option>
        </select>
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

      {/* Ligne 3 : Rareté + collection */}
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

      {/* Accordéon : Effects */}
      <div>
        <button
          type="button"
          onClick={() => setEffectsOpen((v) => !v)}
          className="flex items-center gap-2 w-full text-xs font-semibold text-c-text-muted uppercase tracking-wider py-0.5 hover:text-c-text transition"
        >
          <i className={`fa-solid fa-chevron-${effectsOpen ? 'up' : 'down'} text-[10px]`} />
          {t('effectsFilter')}
          {hasActiveEffects && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />}
        </button>

        {effectsOpen && (
          <div className="flex flex-col gap-3 mt-2">

            {/* Opérateur global AND/OR */}
            {totalSlots > 1 && (
              <div className="flex items-center gap-1 ml-auto">
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

            {/* ── Effet Principal ── */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
                {t('effectMainHeader')}
              </span>
              {slots.map((slot, i) => (
                <EffectSlotRow
                  key={i}
                  slot={slot}
                  index={i}
                  allTriggers={mainTriggerOptions}
                  allConditions={mainConditionOptions}
                  allEffects={mainEffectOptions}
                  locale={locale}
                  onUpdate={(partial) => updateSlot(i, partial)}
                  onRemove={() => removeSlot(i)}
                  t={t}
                />
              ))}
              <button
                type="button"
                onClick={addSlot}
                className="border border-dashed border-c-border rounded-md py-1.5 text-xs text-c-text-muted hover:text-c-text hover:border-c-text-muted transition text-center"
              >
                + {t('effectAddSlot')}
              </button>
            </div>

            {/* ── Support ── */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
                {t('effectSupportHeader')}
              </span>
              {supportSlots.map((slot, i) => (
                <EffectSlotRow
                  key={i}
                  slot={slot}
                  index={i}
                  allTriggers={supportTriggerOptions}
                  allConditions={supportConditionOptions}
                  allEffects={supportEffectOptions}
                  locale={locale}
                  onUpdate={(partial) => updateSupportSlot(i, partial)}
                  onRemove={() => removeSupportSlot(i)}
                  t={t}
                />
              ))}
              <button
                type="button"
                onClick={addSupportSlot}
                className="border border-dashed border-c-border rounded-md py-1.5 text-xs text-c-text-muted hover:text-c-text hover:border-c-text-muted transition text-center"
              >
                + {t('effectAddSlot')}
              </button>
            </div>

          </div>
        )}
      </div>

      {hasActiveFilters && (
        <button onClick={onReset} className="text-xs text-c-text-subtle hover:text-c-text underline text-left">
          {t('resetFilters')}
        </button>
      )}
    </div>
  );
}
