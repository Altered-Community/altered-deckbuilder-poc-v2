import { useQuery } from '@tanstack/react-query';
import { getCollection } from '@/lib/api/collectionApi';
import type { CardGroup } from '@/lib/types/card';
import type { ApiCollectionEntry } from '@/lib/types/collection';

export function useCollection(enabled = true) {
  return useQuery({
    queryKey: ['collection'],
    queryFn: () => getCollection(),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function buildOwnedSet(entries: ApiCollectionEntry[]): Set<string> {
  const set = new Set<string>();
  for (const e of entries) {
    set.add(e.cardReference);
  }
  return set;
}

export function isGroupOwned(group: CardGroup, ownedRefs: Set<string>): boolean {
  return group.cards.some((v) => {
    if (ownedRefs.has(v.reference)) return true;
    const base = v.reference.split('_').slice(0, 6).join('_');
    return ownedRefs.has(base);
  });
}
