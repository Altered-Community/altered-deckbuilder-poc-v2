import type { CardGroup, CardGroupFilters, ApiSet, ApiFaction, PaginatedResponse } from '@/lib/types/card';

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

export async function fetchCardGroups(filters: CardGroupFilters = {}): Promise<PaginatedResponse<CardGroup>> {
  const searchParams = new URLSearchParams();
  searchParams.set('locale', 'fr');
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(`${key}[]`, v));
    } else {
      searchParams.set(key, String(value));
    }
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

export async function fetchCardGroupBySlug(slug: string): Promise<CardGroup | null> {
  const res = await fetch(`${API_BASE}/card_groups/${encodeURIComponent(slug)}?locale=fr`);
  if (!res.ok) return null;
  return res.json();
}


export async function fetchFactions(): Promise<ApiFaction[]> {
  const res = await fetch(`${API_BASE}/factions`);
  if (!res.ok) throw new Error('Erreur lors de la récupération des factions');
  return normalizeList<ApiFaction>(await res.json());
}
