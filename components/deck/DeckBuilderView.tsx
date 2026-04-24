'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import CardBrowser from '@/components/cards/CardBrowser';
import DeckPanel from '@/components/deck/DeckPanel';
import { useDeckStore } from '@/store/deckStore';
import { getCardGroupFaction } from '@/lib/utils/card';
import { FACTIONS, FACTION_BADGE_COLORS } from '@/lib/types/constants';

interface Props {
  initialFaction?: string;
}

export default function DeckBuilderView({ initialFaction }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const hero = useDeckStore((s) => s.deck.hero);
  const deckStats = useDeckStore((s) => s.deckStats);
  const { playableCount } = deckStats();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    if (mounted && !hero) router.replace('/');
  }, [mounted, hero, router]);

  if (!mounted) return null;
  if (!hero) return null;

  const factionCode = getCardGroupFaction(hero);
  const factionName = factionCode ? FACTIONS[factionCode] : '';
  const factionBadge = factionCode ? (FACTION_BADGE_COLORS[factionCode] ?? 'bg-gray-600') : 'bg-gray-700';

  return (
    <div className="flex flex-col overflow-hidden" style={{ flex: 1, minHeight: 0 }}>

      {/* Sous-barre héros */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-c-surface border-b border-c-border-subtle text-xs">
        {factionCode && (
          <span className={`font-bold px-1.5 py-0.5 rounded text-white ${factionBadge}`}>
            {factionCode}
          </span>
        )}
        <span className="font-semibold text-c-text">{hero.name}</span>
        {factionName && <span className="text-c-text-muted">{factionName}</span>}
        <Link href="/" className="ml-auto text-c-text-subtle hover:text-c-text transition underline">
          {t('deckBuilder.change')}
        </Link>
      </div>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-[3] flex flex-col p-4 border-r border-c-border-subtle overflow-hidden">
          <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest mb-3">
            {t('deckBuilder.cardLibrary')}
          </h2>
          <div className="flex-1 overflow-hidden">
            <CardBrowser key={factionCode ?? initialFaction} initialFaction={factionCode ?? initialFaction} />
          </div>
        </div>

        <div className="flex-[1] flex flex-col p-4 overflow-hidden">
          <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest mb-3 flex items-center justify-between">
            <span>{t('deckBuilder.myDeck')}</span>
            {playableCount > 0 && (
              <span className="text-xs font-bold text-c-text tabular-nums normal-case tracking-normal">
                {playableCount}
              </span>
            )}
          </h2>
          <div className="flex-1 overflow-hidden">
            <DeckPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
