import type { ApiCollectionEntry, BatchAddResult } from '@/lib/types/collection';
import { getValidToken } from '@/store/authStore';

const COLLECTION_BASE =
  typeof window === 'undefined'
    ? (process.env.NEXT_PUBLIC_COLLECTION_API_URL ?? 'http://localhost:5000').replace(/\/$/, '')
    : '/collection-api-proxy';

async function collectionFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidToken();
  return fetch(`${COLLECTION_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

export async function getCollection(): Promise<ApiCollectionEntry[]> {
  const res = await collectionFetch('/api/collection');
  if (!res.ok) throw new Error(`Erreur chargement collection : ${res.status}`);
  return res.json();
}

export async function addCollectionEntry(
  cardReference: string,
  quantity: number,
  isFoil = false,
): Promise<ApiCollectionEntry> {
  const res = await collectionFetch('/api/collection', {
    method: 'POST',
    body: JSON.stringify({ cardReference, quantity, isFoil }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status}${text ? ' — ' + text : ''}`);
  }
  return res.json();
}

export async function batchAddCollectionEntries(
  cards: { cardReference: string; quantity: number; isFoil?: boolean }[]
): Promise<BatchAddResult> {
  const res = await collectionFetch('/api/collection/batch', {
    method: 'POST',
    body: JSON.stringify({ cards }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status}${text ? ' — ' + text : ''}`);
  }
  return res.json();
}

export async function deleteCollectionEntry(id: number): Promise<void> {
  const res = await collectionFetch(`/api/collection/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`Suppression échouée : ${res.status}`);
}
