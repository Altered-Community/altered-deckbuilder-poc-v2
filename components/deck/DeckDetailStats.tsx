'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { fetchSets } from '@/lib/api/cardApi';
import { getRarityFromSlug } from '@/lib/utils/card';
import { CARD_TYPE_LABELS } from '@/lib/types/constants';
import type { ApiDeckCard } from '@/lib/types/deck';

interface Props {
  cards: ApiDeckCard[];
}

const NON_PLAYABLE = new Set(['HERO', 'TOKEN', 'TOKEN_MANA']);

const RARITY_COLORS: Record<string, string> = {
  COMMON:  'bg-gray-400 dark:bg-gray-500',
  RARE:    'bg-blue-500',
  UNIQUE:  'bg-yellow-400',
  EXALTED: 'bg-purple-500',
};

const TYPE_COLORS: Record<string, string> = {
  CHARACTER:            'bg-sky-500',
  SPELL:                'bg-violet-500',
  PERMANENT:            'bg-emerald-500',
  LANDMARK_PERMANENT:   'bg-orange-500',
  EXPEDITION_PERMANENT: 'bg-amber-400',
  TOKEN:                'bg-gray-400',
  TOKEN_MANA:           'bg-gray-300',
  HERO:                 'bg-yellow-400',
};

function getSetCode(ref: string): string {
  if (!ref.startsWith('ALT_')) return '?';
  return ref.split('_')[1] ?? '?';
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-c-text-muted uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

function CostCurve({ data, max, color = 'bg-blue-500' }: {
  data: Record<number, number>;
  max: number;
  color?: string;
}) {
  return (
    <div className="flex items-end gap-1 h-20">
      {Array.from({ length: 9 }, (_, i) => {
        const count = data[i] ?? 0;
        const height = max > 0 ? Math.max((count / max) * 60, count > 0 ? 4 : 0) : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            {count > 0 && (
              <span className="text-[9px] text-c-text-subtle tabular-nums leading-none">{count}</span>
            )}
            <div
              className={`w-full ${color} rounded-sm transition-all`}
              style={{ height: `${height}px` }}
            />
            <span className="text-[9px] text-c-text-subtle leading-none mt-0.5">
              {i === 8 ? '8+' : i}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DistributionRow({
  label,
  count,
  total,
  color = 'bg-blue-500',
}: {
  label: string;
  count: number;
  total: number;
  color?: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-c-text-secondary truncate w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-c-input rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-c-text-muted tabular-nums shrink-0 w-5 text-right">{count}</span>
    </div>
  );
}

export default function DeckDetailStats({ cards }: Props) {
  const t = useTranslations('deckDetailStats');

  const { data: sets = [] } = useQuery({
    queryKey: ['sets'],
    queryFn: fetchSets,
    staleTime: Infinity,
  });

  const setNameMap = Object.fromEntries(sets.map((s) => [s.reference, s.name]));

  const playable = cards.filter((dc) => !NON_PLAYABLE.has(dc.cardTypeReference ?? ''));
  const totalAll = cards.reduce((s, dc) => s + dc.quantity, 0);

  // Cost curves (exclude hero/token)
  const mainCurve: Record<number, number> = {};
  const recallCurve: Record<number, number> = {};
  let hasRecall = false;

  for (const dc of playable) {
    if (dc.mainCost != null) {
      const b = Math.min(dc.mainCost, 8);
      mainCurve[b] = (mainCurve[b] ?? 0) + dc.quantity;
    }
    if (dc.recallCost != null) {
      hasRecall = true;
      const b = Math.min(dc.recallCost, 8);
      recallCurve[b] = (recallCurve[b] ?? 0) + dc.quantity;
    }
  }

  const maxMain = Math.max(...Object.values(mainCurve), 1);
  const maxRecall = Math.max(...Object.values(recallCurve), 1);

  // By set
  const bySets: Record<string, number> = {};
  for (const dc of cards) {
    const code = dc.setReference ?? getSetCode(dc.cardReference);
    bySets[code] = (bySets[code] ?? 0) + dc.quantity;
  }
  const setEntries = Object.entries(bySets).sort(([, a], [, b]) => b - a);

  // By type
  const byType: Record<string, number> = {};
  for (const dc of cards) {
    const type = dc.cardTypeReference ?? 'OTHER';
    byType[type] = (byType[type] ?? 0) + dc.quantity;
  }
  const typeEntries = Object.entries(byType).sort(([, a], [, b]) => b - a);

  // By rarity
  const byRarity: Record<string, number> = {};
  for (const dc of cards) {
    const rarity = getRarityFromSlug(dc.cardReference);
    byRarity[rarity] = (byRarity[rarity] ?? 0) + dc.quantity;
  }
  const rarityOrder = ['COMMON', 'RARE', 'UNIQUE', 'EXALTED'];
  const rarityEntries = rarityOrder
    .filter((r) => byRarity[r])
    .map((r) => [r, byRarity[r]] as [string, number]);

  return (
    <div className="h-full overflow-y-auto px-5 py-5 flex flex-col gap-6">

      {/* Courbe de main */}
      <div>
        <SectionTitle>{t('mainCostCurve')}</SectionTitle>
        {Object.keys(mainCurve).length > 0 ? (
          <CostCurve data={mainCurve} max={maxMain} color="bg-blue-500" />
        ) : (
          <p className="text-xs text-c-text-subtle italic">{t('noRecallData')}</p>
        )}
      </div>

      {/* Courbe de réserve */}
      <div>
        <SectionTitle>{t('recallCostCurve')}</SectionTitle>
        {hasRecall ? (
          <CostCurve data={recallCurve} max={maxRecall} color="bg-violet-500" />
        ) : (
          <p className="text-xs text-c-text-subtle italic">{t('noRecallData')}</p>
        )}
      </div>

      {/* Par set */}
      {setEntries.length > 0 && (
        <div>
          <SectionTitle>{t('bySet')}</SectionTitle>
          <div className="flex flex-col gap-2">
            {setEntries.map(([code, count]) => (
              <DistributionRow
                key={code}
                label={setNameMap[code] ?? code}
                count={count}
                total={totalAll}
                color="bg-indigo-400"
              />
            ))}
          </div>
        </div>
      )}

      {/* Par type */}
      {typeEntries.length > 0 && (
        <div>
          <SectionTitle>{t('byType')}</SectionTitle>
          <div className="flex flex-col gap-2">
            {typeEntries.map(([type, count]) => (
              <DistributionRow
                key={type}
                label={CARD_TYPE_LABELS[type] ?? type}
                count={count}
                total={totalAll}
                color={TYPE_COLORS[type] ?? 'bg-gray-400'}
              />
            ))}
          </div>
        </div>
      )}

      {/* Par rareté */}
      {rarityEntries.length > 0 && (
        <div>
          <SectionTitle>{t('byRarity')}</SectionTitle>
          <div className="flex flex-col gap-2">
            {rarityEntries.map(([rarity, count]) => (
              <DistributionRow
                key={rarity}
                label={t(`rarities.${rarity}`)}
                count={count}
                total={totalAll}
                color={RARITY_COLORS[rarity] ?? 'bg-gray-400'}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
