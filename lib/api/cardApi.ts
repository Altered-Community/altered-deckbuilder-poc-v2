import type { CardGroup, CardGroupFilters, ApiSet, ApiFaction, ApiKeyword, ApiTrigger, ApiEffect, ApiCondition, EffectChainItem, SlotFacetsResponse, PaginatedResponse } from '@/lib/types/card';

const API_BASE =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(/\/$/, '')
    : '/api-proxy';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCollection<T>(data: any): PaginatedResponse<T> {
  return {
    data: data.member ?? [],
    pagination: {
      totalItems: data.totalItems ?? 0,
      itemsPerPage: data.itemsPerPage ?? 30,
      currentPage: data.currentPage ?? 1,
      lastPage: data.lastPage ?? 1,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeList<T>(data: any): T[] {
  return Array.isArray(data) ? data : (data?.member ?? []);
}

function appendCostParam(params: URLSearchParams, key: string, raw: string): void {
  const v = raw.trim();
  if (!v) return;
  const range = v.match(/^(\d+)-(\d+)$/);
  if (range) {
    params.set(`${key}[gte]`, range[1]);
    params.set(`${key}[lte]`, range[2]);
    return;
  }
  if (v.includes(',')) {
    v.split(',').map(s => s.trim()).filter(Boolean).forEach(n => params.append(`${key}[]`, n));
    return;
  }
  params.set(key, v);
}

export async function fetchCardGroups(filters: CardGroupFilters = {}, locale = 'fr'): Promise<PaginatedResponse<CardGroup>> {
  const { excludeCardTypes, excludeCardSubTypes, effectKeyword, reference, costComparison, effectSlots, effectSlotsOperator, supportEffectSlots, effectSupport, mainCost, recallCost, oceanPower, mountainPower, forestPower, ...rest } = filters;
  const searchParams = new URLSearchParams();
  searchParams.set('locale', locale);
  if (reference) searchParams.append('cards.reference[]', reference);
  if (costComparison) searchParams.set('costRelation', costComparison);
  Object.entries(rest).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(`${key}[]`, v));
    } else {
      searchParams.set(key, String(value));
    }
  });
  excludeCardTypes?.forEach((type) => searchParams.append('cardType[ne][]', type));
  excludeCardSubTypes?.forEach((sub) => searchParams.append('cardSubTypes[ne][]', sub));
  if (effectKeyword) {
    const kws = Array.isArray(effectKeyword) ? effectKeyword : [effectKeyword];
    kws.forEach((k) => searchParams.append('effectKeyword', k));
  }
  if (effectSupport !== undefined) searchParams.set('effectSupport', String(effectSupport));
  if (mainCost)      appendCostParam(searchParams, 'mainCost',      mainCost);
  if (recallCost)    appendCostParam(searchParams, 'recallCost',    recallCost);
  if (oceanPower)    appendCostParam(searchParams, 'oceanPower',    oceanPower);
  if (mountainPower) appendCostParam(searchParams, 'mountainPower', mountainPower);
  if (forestPower)   appendCostParam(searchParams, 'forestPower',   forestPower);
  const allSlots = [...(effectSlots ?? []), ...(supportEffectSlots ?? [])];
  if (allSlots.length) searchParams.set('effectSlotMode', (effectSlotsOperator ?? 'AND').toLowerCase());
  allSlots.forEach((slot, i) => {
    const idx = i + 1;
    slot.trigger?.split(',').map(v => v.trim()).filter(Boolean).forEach(v => searchParams.append(`effectSlot[${idx}][trigger]`, v));
    slot.condition?.split(',').map(v => v.trim()).filter(Boolean).forEach(v => searchParams.append(`effectSlot[${idx}][condition]`, v));
    slot.output?.split(',').map(v => v.trim()).filter(Boolean).forEach(v => searchParams.append(`effectSlot[${idx}][effect]`, v));
  });
  const res = await fetch(`${API_BASE}/card_groups?${searchParams}`);
  if (!res.ok) throw new Error('Erreur lors de la récupération des cartes');
  return normalizeCollection<CardGroup>(await res.json());
}

export async function fetchSets(): Promise<ApiSet[]> {
  const res = await fetch(`${API_BASE}/sets`);
  if (!res.ok) throw new Error('Erreur lors de la récupération des sets');
  return normalizeList<ApiSet>(await res.json());
}

export async function fetchCardGroupBySlug(slug: string, locale = 'fr'): Promise<CardGroup | null> {
  const res = await fetch(`${API_BASE}/card_groups/${encodeURIComponent(slug)}?locale=${locale}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchCardGroupByReference(reference: string, locale = 'fr'): Promise<CardGroup | null> {
  const params = new URLSearchParams({ locale });
  params.append('cards.reference[]', reference);
  const res = await fetch(`${API_BASE}/card_groups?${params}`);
  if (!res.ok) return null;
  const data = normalizeCollection<CardGroup>(await res.json());
  return data.data[0] ?? null;
}


export async function fetchKeywords(locale = 'fr'): Promise<ApiKeyword[]> {
  const res = await fetch(`${API_BASE}/keywords?locale=${locale}`);
  if (!res.ok) throw new Error('Erreur lors de la récupération des keywords');
  return normalizeList<ApiKeyword>(await res.json());
}

export async function fetchFactions(): Promise<ApiFaction[]> {
  const res = await fetch(`${API_BASE}/factions`);
  if (!res.ok) throw new Error('Erreur lors de la récupération des factions');
  return normalizeList<ApiFaction>(await res.json());
}

export async function fetchTriggers(): Promise<ApiTrigger[]> {
  const res = await fetch(`${API_BASE}/triggers`);
  if (!res.ok) throw new Error('Erreur lors de la récupération des triggers');
  return normalizeList<ApiTrigger>(await res.json());
}

export async function fetchEffects(): Promise<ApiEffect[]> {
  const res = await fetch(`${API_BASE}/effects`);
  if (!res.ok) throw new Error('Erreur lors de la récupération des effets');
  return normalizeList<ApiEffect>(await res.json());
}

export async function fetchConditions(): Promise<ApiCondition[]> {
  const res = await fetch(`${API_BASE}/conditions`);
  if (!res.ok) throw new Error('Erreur lors de la récupération des conditions');
  return normalizeList<ApiCondition>(await res.json());
}

export async function fetchSlotFacets(triggerId?: string, conditionId?: string, effectId?: string): Promise<SlotFacetsResponse> {
  const empty: SlotFacetsResponse = { triggers: {}, conditions: {}, effects: {} };
  if (!triggerId && !conditionId && !effectId) return empty;
  const params = new URLSearchParams();
  if (triggerId)   params.set('slot[trigger]',   triggerId);
  if (conditionId) params.set('slot[condition]',  conditionId);
  if (effectId)    params.set('slot[effect]',     effectId);
  const res = await fetch(`${API_BASE}/cards/slot-facets?${params}`);
  if (!res.ok) return empty;
  return res.json();
}

export async function fetchEffectChainConditions(triggerId?: string, effectId?: string): Promise<EffectChainItem[]> {
  const params = new URLSearchParams();
  if (triggerId) params.set('trigger', triggerId);
  if (effectId) params.set('effect', effectId);
  const res = await fetch(`${API_BASE}/effect-chain/conditions?${params}`);
  if (!res.ok) return [];
  return normalizeList<EffectChainItem>(await res.json());
}

export async function fetchEffectChainEffects(triggerId?: string, conditionId?: string): Promise<EffectChainItem[]> {
  const params = new URLSearchParams();
  if (triggerId) params.set('trigger', triggerId);
  if (conditionId) params.set('condition', conditionId);
  const res = await fetch(`${API_BASE}/effect-chain/effects?${params}`);
  if (!res.ok) return [];
  return normalizeList<EffectChainItem>(await res.json());
}

export async function fetchEffectChainTriggers(effectId?: string, conditionId?: string): Promise<EffectChainItem[]> {
  const params = new URLSearchParams();
  if (effectId) params.set('effect', effectId);
  if (conditionId) params.set('condition', conditionId);
  const res = await fetch(`${API_BASE}/effect-chain/triggers?${params}`);
  if (!res.ok) return [];
  return normalizeList<EffectChainItem>(await res.json());
}

const REF_BATCH_SIZE = 50;

export async function fetchCardGroupsByRefs(refs: string[], locale = 'fr'): Promise<CardGroup[]> {
  if (refs.length === 0) return [];
  const all: CardGroup[] = [];
  for (let i = 0; i < refs.length; i += REF_BATCH_SIZE) {
    const batch = refs.slice(i, i + REF_BATCH_SIZE);
    const params = new URLSearchParams({ locale, itemsPerPage: String(REF_BATCH_SIZE) });
    batch.forEach((ref) => params.append('cards.reference[]', ref));
    const res = await fetch(`${API_BASE}/card_groups?${params}`);
    if (!res.ok) throw new Error('Erreur récupération cartes collection');
    const data = normalizeCollection<CardGroup>(await res.json());
    all.push(...data.data);
  }
  return all;
}

const VERIFY_BATCH_SIZE = 50;

export async function verifyCardReferences(references: string[], locale = 'fr'): Promise<{ found: string[]; notFound: string[] }> {
  if (references.length === 0) return { found: [], notFound: [] };

  const found: string[] = [];

  // Split into batches to avoid 414 Request-URI Too Large
  for (let i = 0; i < references.length; i += VERIFY_BATCH_SIZE) {
    const batch = references.slice(i, i + VERIFY_BATCH_SIZE);
    const params = batch.map((ref) => `cards.reference[]=${encodeURIComponent(ref)}`).join('&');
    const res = await fetch(`${API_BASE}/card_groups?${params}&locale=${locale}&itemsPerPage=${VERIFY_BATCH_SIZE}`);
    if (!res.ok) throw new Error('Erreur lors de la vérification des cartes');

    const data = await res.json();
    (data.member ?? []).forEach((c: { reference?: string; cards?: Array<{ reference?: string }> }) => {
      if (c.reference) found.push(c.reference);
      c.cards?.forEach((v) => v.reference && found.push(v.reference));
    });
  }

  const notFound = references.filter((ref) => !found.includes(ref));

  for (const ref of notFound) {
    try {
      const res = await fetch(`https://cards.alteredcore.org/api/cards/scrape/${ref}`);
      if (res.ok) found.push(ref);
    } catch {}
  }

  const finalNotFound = references.filter((ref) => !found.includes(ref));
  return { found, notFound: finalNotFound };
}
