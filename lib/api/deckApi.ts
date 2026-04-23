import type { ApiDeck, ApiDeckDetail, ApiFormat, SaveDeckPayload } from '@/lib/types/deck';
import { getValidToken } from '@/store/authStore';

const DECK_API_BASE =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_DECK_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
    : '/deck-api-proxy';

async function deckFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidToken();
  console.log('[api] fetch', path, 'token:', token.substring(0, 20) + '...');
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

export async function saveDeck(payload: SaveDeckPayload): Promise<{ id: string }> {
  const res = await deckFetch('/decks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text || 'Erreur inconnue';
    try {
      const json = JSON.parse(text);
      if (Array.isArray(json.violations) && json.violations.length > 0) {
        detail = json.violations
          .map((v: { propertyPath: string; message: string }) => `${v.propertyPath}: ${v.message}`)
          .join('\n');
      } else {
        detail = (json.detail ?? json.title ?? text) || 'Erreur inconnue';
      }
    } catch {}
    throw new Error(`${res.status} — ${detail}`);
  }
  return res.json();
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