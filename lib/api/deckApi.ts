import type { ApiDeck, ApiDeckDetail, ApiFormat, SaveDeckPayload } from '@/lib/types/deck';

const DECK_API_BASE =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_DECK_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
    : '/deck-api-proxy';

const DEV_AUTH_PAYLOAD = {
  sub: process.env.NEXT_PUBLIC_DEV_AUTH_SUB ?? '',
  email: process.env.NEXT_PUBLIC_DEV_AUTH_EMAIL ?? '',
  username: process.env.NEXT_PUBLIC_DEV_AUTH_USERNAME ?? '',
};

export function deckFetch(path: string, token: string, options: RequestInit = {}): Promise<Response> {
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

export async function devLogin(): Promise<string> {
  const res = await fetch(`${DECK_API_BASE}/dev/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DEV_AUTH_PAYLOAD),
  });
  if (!res.ok) throw new Error(`Auth dev échouée : ${res.status}`);
  const data = await res.json();
  const token = data.token ?? data.access_token ?? data.bearer ?? data.accessToken;
  if (!token) throw new Error('Token introuvable dans la réponse');
  return token;
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

export async function getDecks(token: string): Promise<ApiDeck[]> {
  const res = await deckFetch('/decks', token);
  if (!res.ok) throw new Error(`Erreur chargement decks : ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data['hydra:member'] ?? data['member'] ?? data['data'] ?? [];
}

export async function getDeckDetail(id: string, token: string): Promise<ApiDeckDetail> {
  const res = await deckFetch(`/decks/${id}`, token);
  if (!res.ok) throw new Error(`Erreur chargement deck : ${res.status}`);
  return res.json();
}

export async function saveDeck(payload: SaveDeckPayload, token: string): Promise<{ id: string }> {
  const res = await deckFetch('/decks', token, {
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
  token: string,
): Promise<ApiDeck> {
  const res = await deckFetch(`/decks/${id}`, token, {
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

export async function deleteDeck(id: string, token: string): Promise<void> {
  const res = await deckFetch(`/decks/${id}`, token, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`Suppression échouée : ${res.status}`);
}
