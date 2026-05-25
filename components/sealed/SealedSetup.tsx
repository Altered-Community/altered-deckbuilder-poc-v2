'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { fetchCardGroups } from '@/lib/api/cardApi';
import { useSealedStore, type SealedDeckCard, type SealedPack } from '@/store/sealedStore';
import { getRarityFromSlug } from '@/lib/utils/card';
import { SET_NAMES } from '@/lib/types/constants';
import type { CardGroup } from '@/lib/types/card';
import SiteFooter from '@/components/layout/SiteFooter';

export const PACKS = 7;
const COMMONS_PER_PACK = 8;
const RARES_PER_PACK = 3;
const UNIQUE_CHANCE_PER_PACK = 1 / 8;

const OFFICIAL_SEALED_SETS: { ref: string }[] = [
  { ref: 'FUGUE' },
  { ref: 'EOLE' },
  { ref: 'DUSTER' },
  { ref: 'CYCLONE' },
  { ref: 'BISE' },
  { ref: 'ALIZE' },
  { ref: 'CORE' },
];

function pickRandom<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function addCount(counts: Map<string, { cardGroup: CardGroup; quantity: number }>, card: CardGroup) {
  const e = counts.get(card.slug);
  if (e) { e.quantity += 1; } else { counts.set(card.slug, { cardGroup: card, quantity: 1 }); }
}

interface SetCardData {
  regularCards: CardGroup[];
  heroes: CardGroup[];
}

async function fetchSetCardData(setRef: string, locale: string): Promise<SetCardData> {
  const [regularFirst, heroFirst] = await Promise.all([
    fetchCardGroups({
      'set.reference': setRef,
      rarity: ['COMMON', 'RARE'] as string[],
      excludeCardTypes: ['HERO', 'TOKEN', 'TOKEN_MANA'],
      page: 1,
      itemsPerPage: 100,
    }, locale),
    fetchCardGroups({
      'set.reference': setRef,
      cardType: 'HERO',
      page: 1,
      itemsPerPage: 100,
    }, locale),
  ]);

  const [regularRest, heroRest] = await Promise.all([
    Promise.all(
      Array.from({ length: regularFirst.pagination.lastPage - 1 }, (_, i) =>
        fetchCardGroups({ 'set.reference': setRef, rarity: ['COMMON', 'RARE'] as string[], excludeCardTypes: ['HERO', 'TOKEN', 'TOKEN_MANA'], page: i + 2, itemsPerPage: 100 }, locale)
      )
    ),
    Promise.all(
      Array.from({ length: heroFirst.pagination.lastPage - 1 }, (_, i) =>
        fetchCardGroups({ 'set.reference': setRef, cardType: 'HERO', page: i + 2, itemsPerPage: 100 }, locale)
      )
    ),
  ]);

  return {
    regularCards: [...regularFirst.data, ...regularRest.flatMap((r) => r.data)],
    heroes: [...heroFirst.data, ...heroRest.flatMap((r) => r.data)],
  };
}

interface GeneratedPool {
  packs: SealedPack[];
  pool: SealedDeckCard[];
  heroPool: CardGroup[];
  uniqueDrawsAvailable: number;
}

function generatePool(regularCards: CardGroup[], allHeroes: CardGroup[]): GeneratedPool {
  const commons = regularCards.filter((c) => getRarityFromSlug(c.slug) === 'COMMON');
  const rares = regularCards.filter((c) => getRarityFromSlug(c.slug) === 'RARE');
  const commonPool = commons.length ? commons : regularCards;
  const rarePool = rares.length ? rares : regularCards;

  const counts = new Map<string, { cardGroup: CardGroup; quantity: number }>();
  const packs: SealedPack[] = [];
  const heroesSeenMap = new Map<string, CardGroup>();
  let uniqueDrawsAvailable = 0;

  for (let p = 0; p < PACKS; p++) {
    // 1 héros par booster
    const hero = pickRandom(allHeroes);
    if (hero && !heroesSeenMap.has(hero.slug)) heroesSeenMap.set(hero.slug, hero);

    // 8 communes
    const packCommons: CardGroup[] = [];
    for (let i = 0; i < COMMONS_PER_PACK; i++) {
      const card = pickRandom(commonPool);
      if (card) { packCommons.push(card); addCount(counts, card); }
    }

    // 3 rares (1/8 : un slot devient une unique)
    const packRares: CardGroup[] = [];
    let hasUniqueSlot = false;
    let rareSlots = RARES_PER_PACK;
    if (Math.random() < UNIQUE_CHANCE_PER_PACK) {
      rareSlots -= 1;
      hasUniqueSlot = true;
      uniqueDrawsAvailable += 1;
    }
    for (let i = 0; i < rareSlots; i++) {
      const card = pickRandom(rarePool);
      if (card) { packRares.push(card); addCount(counts, card); }
    }

    packs.push({ id: p + 1, hero, commons: packCommons, rares: packRares, hasUniqueSlot });
  }

  return {
    packs,
    pool: Array.from(counts.values()),
    heroPool: Array.from(heroesSeenMap.values()),
    uniqueDrawsAvailable,
  };
}

export default function SealedSetup() {
  const t = useTranslations('sealed');
  const locale = useLocale();
  const { pool, selectedSet, setPool, setSelectedSet } = useSealedStore();

  const [chosenSet, setChosenSet] = useState(selectedSet ?? '');
  const [error, setError] = useState<string | null>(null);

  const { data: setCardData, isLoading: cardsLoading, isError: cardsError } = useQuery({
    queryKey: ['sealed-set-cards', chosenSet, locale],
    queryFn: () => fetchSetCardData(chosenSet, locale),
    enabled: !!chosenSet,
    staleTime: 10 * 60 * 1000,
  });

  const handleOpenPacks = () => {
    if (!setCardData?.regularCards.length) return;
    setError(null);
    try {
      const { packs, pool, heroPool, uniqueDrawsAvailable } = generatePool(
        setCardData.regularCards,
        setCardData.heroes,
      );
      setPool(pool, packs, heroPool, uniqueDrawsAvailable);
      setSelectedSet(chosenSet);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorOpening'));
    }
  };

  const setName = (ref: string) => {
    const localeKey = locale as 'fr' | 'en';
    return SET_NAMES[ref]?.[localeKey] ?? ref;
  };

  if (pool.length > 0) return null;

  const canOpen = !!chosenSet && !!setCardData?.regularCards.length && !cardsLoading;

  return (
    <div className="flex flex-col flex-1">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-8">

        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">🃏</div>
          <h1 className="text-3xl font-bold text-c-text mb-2">{t('setupTitle')}</h1>
          <p className="text-c-text-muted text-sm leading-relaxed">{t('setupSubtitle')}</p>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-c-text-muted uppercase tracking-wide mb-2">
              {t('chooseSet')}
            </label>
            <select
              value={chosenSet}
              onChange={(e) => { setChosenSet(e.target.value); setError(null); }}
              className="w-full px-3 py-2.5 bg-c-elevated border border-c-border rounded-lg text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('selectSet')}</option>
              {OFFICIAL_SEALED_SETS.map(({ ref }) => (
                <option key={ref} value={ref}>{setName(ref)}</option>
              ))}
            </select>

            {chosenSet && cardsLoading && (
              <div className="flex items-center gap-2 mt-2 text-xs text-c-text-muted">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400" />
                {t('loadingCards')}
              </div>
            )}
            {cardsError && <p className="mt-2 text-xs text-red-400">{t('errorOpening')}</p>}
          </div>

          <button
            onClick={handleOpenPacks}
            disabled={!canOpen}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-box-open" />
            {t('openPacks', { count: PACKS })}
          </button>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        </div>

        <div className="w-full max-w-sm bg-c-elevated rounded-xl border border-c-border p-4 text-xs text-c-text-muted space-y-1.5">
          <p className="font-semibold text-c-text uppercase tracking-wide text-[10px] mb-2">{t('rulesTitle')}</p>
          <p>• {t('rule1', { count: PACKS })}</p>
          <p>• {t('rule2')}</p>
          <p>• {t('rule3')}</p>
          <p>• {t('rule4')}</p>
          <p>• {t('rule5')}</p>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
