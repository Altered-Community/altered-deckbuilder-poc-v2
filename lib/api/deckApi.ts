import type { ApiDeck, ApiDeckDetail, ApiFormat, ApiPaginatedResponse, SaveDeckPayload } from '@/lib/types/deck';
import { getValidToken } from '@/store/authStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  return data['hydra:member'] ?? data['member'] ?? data['data'] ?? [];
}

const DECK_API_BASE =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_DECK_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
    : '/deck-api-proxy';

async function deckFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidToken();
  return fetch(`${DECK_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

async function tryGetToken(): Promise<string | null> {
  try { return await getValidToken(); } catch { return null; }
}

export async function fetchFormats(): Promise<ApiFormat[]> {
  const res = await fetch(`${DECK_API_BASE}/formats`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Erreur formats : ${res.status}`);
  return normalizeArray<ApiFormat>(await res.json());
}

function normalizePaginated<T>(data: Record<string, unknown>): ApiPaginatedResponse<T> {
  const items = normalizeArray<T>(data);
  return {
    items,
    totalItems: (data.totalItems as number) ?? items.length,
    currentPage: (data.currentPage as number) ?? 1,
    lastPage: (data.lastPage as number) ?? 1,
    nextPage: (data.nextPage as number | null) ?? null,
    previousPage: (data.previousPage as number | null) ?? null,
  };
}

export interface PublicHero {
  reference: string;
  name: string;
  imagePath: string | null;
}

export async function getPublicHeroes(locale = 'fr'): Promise<PublicHero[]> {
  const res = await fetch(`${DECK_API_BASE}/decks/public/heroes?locale=${locale}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Erreur héros publics : ${res.status}`);
  return res.json();
}

export async function getDeckByAlteredId(alteredId: string): Promise<ApiDeck | null> {
  const res = await deckFetch(`/decks?alteredId=${encodeURIComponent(alteredId)}&itemsPerPage=1`);
  if (!res.ok) return null;
  const data = await res.json();
  const items = normalizeArray<ApiDeck>(data);
  return items[0] ?? null;
}

export async function getDecks(locale = 'fr', page = 1): Promise<ApiPaginatedResponse<ApiDeck>> {
  const res = await deckFetch(`/decks?locale=${locale}&page=${page}`);
  if (!res.ok) throw new Error(`Erreur chargement decks : ${res.status}`);
  return normalizePaginated<ApiDeck>(await res.json());
}

export async function getPublicDecks(
  locale = 'fr',
  page = 1,
  filters: { cardName?: string; sortBy?: 'recent' | 'upvotes' | 'views'; hero?: string } = {},
): Promise<ApiPaginatedResponse<ApiDeck>> {
  const params = new URLSearchParams({ locale, page: String(page) });
  if (filters.cardName) params.set('cardName', filters.cardName);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.hero) params.set('hero', filters.hero);
  const token = await tryGetToken();
  const headers: HeadersInit = { Accept: 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${DECK_API_BASE}/decks/public?${params}`, { headers });
  if (!res.ok) throw new Error(`Erreur chargement decks publics : ${res.status}`);
  return normalizePaginated<ApiDeck>(await res.json());
}

export async function upvoteDeck(id: string): Promise<{ upvoteCount: number; hasUpvoted: boolean }> {
  const res = await deckFetch(`/decks/${id}/upvote`, { method: 'POST' });
  if (!res.ok) throw new Error(`Upvote échoué : ${res.status}`);
  return res.json();
}

export async function getDeckDetail(id: string, locale = 'fr'): Promise<ApiDeckDetail> {
  const res = await deckFetch(`/decks/${id}?locale=${locale}`);
  if (!res.ok) throw new Error(`Erreur chargement deck : ${res.status}`);
  return res.json();
}

export async function getDeckDetailPublic(id: string, locale = 'fr'): Promise<ApiDeckDetail> {
  const res = await fetch(`${DECK_API_BASE}/decks/${id}?locale=${locale}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Erreur chargement deck : ${res.status}`);
  return res.json();
}

export interface SaveDeckResponse {
  id: string;
  unknownCards?: string[];
}

export async function saveDeck(payload: SaveDeckPayload): Promise<SaveDeckResponse> {
  const res = await deckFetch('/decks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  const unknownCards = data.unknownCards as string[] | undefined;

  if (res.ok) {
    return { id: data.id ?? data['@id'] ?? '', unknownCards };
  }

  let detail = (data.detail ?? data.title ?? '') || 'Erreur inconnue';
  if (Array.isArray(data.violations) && data.violations.length > 0) {
    detail = data.violations
      .map((v: { propertyPath: string; message: string }) => `${v.propertyPath}: ${v.message}`)
      .join('\n');
  } else if (unknownCards?.length) {
    detail = 'Cartes non trouvées: ' + unknownCards.join(', ');
  }

  throw new Error(`${res.status} — ${detail}`);
}

export async function patchDeck(
  id: string,
  payload: Partial<Pick<ApiDeck, 'name' | 'description' | 'format' | 'isPublic'>> & {
    deckCards?: { cardReference: string; quantity: number }[];
  },
): Promise<ApiDeck> {
  const res = await deckFetch(`/decks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/merge-patch+json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Mise à jour échouée : ${res.status}${text ? ' — ' + text : ''}`);
  }
  return res.json();
}

export async function deleteDeck(id: string): Promise<void> {
  const res = await deckFetch(`/decks/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`Suppression échouée : ${res.status}`);
}

export async function duplicateDeck(id: string, locale = 'fr'): Promise<SaveDeckResponse> {
  const detail = await getDeckDetail(id, locale);
  return saveDeck({
    name: `Copie de ${detail.name}`,
    description: detail.description,
    format: detail.format,
    isPublic: false,
    deckCards: detail.cards.map((c) => ({ cardReference: c.cardReference, quantity: c.quantity })),
  });
}