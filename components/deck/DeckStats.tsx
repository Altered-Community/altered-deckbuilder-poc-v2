'use client';

import { useTranslations } from 'next-intl';
import { useDeckStore } from '@/store/deckStore';
import { FACTIONS, FACTION_BADGE_COLORS, MIN_DECK_SIZE } from '@/lib/types/constants';
import { getCardGroupName, getCardGroupFaction } from '@/lib/utils/card';

export default function DeckStats() {
  const t = useTranslations('deck');
  const { deck, deckStats } = useDeckStore();
  const { playableCount: total } = deckStats();
  const minCards = deck.format?.minCards ?? MIN_DECK_SIZE;

  const factionCounts: Record<string, number> = {};
  deck.cards.forEach(({ cardGroup, quantity }) => {
    const code = getCardGroupFaction(cardGroup);
    if (code) factionCounts[code] = (factionCounts[code] ?? 0) + quantity;
  });

  const costCurve: Record<number, number> = {};
  deck.cards.forEach(({ cardGroup, quantity }) => {
    if (cardGroup.mainCost != null) {
      const bucket = Math.min(cardGroup.mainCost, 8);
      costCurve[bucket] = (costCurve[bucket] ?? 0) + quantity;
    }
  });
  const maxCostCount = Math.max(...Object.values(costCurve), 1);

  return (
    <div className="flex flex-col gap-4 p-3 bg-c-elevated rounded-lg text-sm">
      <div>
        <p className="text-c-text-muted text-xs uppercase tracking-wide mb-1">{t('hero')}</p>
        {deck.hero ? (
          <p className="text-c-text font-medium">{getCardGroupName(deck.hero)}</p>
        ) : (
          <p className="text-c-text-subtle italic text-xs">{t('noHero')}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-c-input rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${Math.min((total / minCards) * 100, 100)}%` }}
          />
        </div>
        <span className="text-c-text font-bold tabular-nums text-sm">
          {total}<span className="text-c-text-muted font-normal">/{minCards}</span>
        </span>
      </div>

      {Object.keys(factionCounts).length > 0 && (
        <div>
          <p className="text-c-text-muted text-xs uppercase tracking-wide mb-2">{t('factions')}</p>
          <div className="flex flex-col gap-1.5">
            {Object.entries(factionCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([code, count]) => (
                <div key={code} className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-bold px-1 rounded text-white w-6 text-center ${FACTION_BADGE_COLORS[code] ?? 'bg-gray-600'}`}
                  >
                    {code}
                  </span>
                  <span className="text-xs text-c-text-subtle w-12 truncate">{FACTIONS[code]}</span>
                  <div className="flex-1 h-1.5 bg-c-input rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(count / total) * 100}%`,
                        backgroundColor: `var(--faction-${code}, #6b7280)`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-c-text-secondary w-5 text-right">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {Object.keys(costCurve).length > 0 && (
        <div>
          <p className="text-c-text-muted text-xs uppercase tracking-wide mb-2">{t('costCurve')}</p>
          <div className="flex items-end gap-1 h-14">
            {Array.from({ length: 9 }, (_, i) => {
              const count = costCurve[i] ?? 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  {count > 0 && (
                    <span className="text-[8px] text-c-text-subtle tabular-nums">{count}</span>
                  )}
                  <div
                    className="w-full bg-blue-600 rounded-sm transition-all"
                    style={{ height: `${Math.max((count / maxCostCount) * 36, count > 0 ? 2 : 0)}px` }}
                  />
                  <span className="text-[9px] text-c-text-subtle">{i === 8 ? '8+' : i}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
