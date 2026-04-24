import type { ApiDeck, ApiDeckDetail, ApiFormat, SaveDeckPayload } from '@/lib/types/deck';
import { getValidToken } from '@/store/authStore';

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

export async function fetchFormats(): Promise<ApiFormat[]> {
  const res = await fetch(`${DECK_API_BASE}/formats`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Erreur formats : ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data['hydra:member'] ?? data['member'] ?? data['data'] ?? [];
}

export async function getDecks(): Promise<ApiDeck[]> {
  const res = await deckFetch('/decks');
  if (!res.ok) throw new Error(`Erreur chargement decks : ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data['hydra:member'] ?? data['member'] ?? data['data'] ?? [];
}

export async function getDeckDetail(id: string): Promise<ApiDeckDetail> {
  const res = await deckFetch(`/decks/${id}`);
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