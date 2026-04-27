'use client';

import { useEffect, useSyncExternalStore, useState } from 'react';
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
  const [mobileTab, setMobileTab] = useState<'cards' | 'deck'>('cards');

  useEffect(() => {
    if (mounted && !hero) router.replace('/');
  }, [mounted, hero, router]);

  if (!mounted) return null;
  if (!hero) return null;

  const factionCode = getCardGroupFaction(hero);
  const factionName = factionCode ? FACTIONS[factionCode] : '';
  const factionBadge = factionCode ? (FACTION_BADGE_COLORS[factionCode] ?? 'bg-gray-600') : 'bg-gray-700';

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - var(--nav-h))', minHeight: 0 }}>

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

      <main className="flex-1 flex overflow-hidden min-h-0">

        {/* ── Desktop : côte à côte ── */}
        <div className="hidden md:flex flex-[3] flex-col p-4 border-r border-c-border-subtle overflow-hidden">
          <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest mb-3">
            {t('deckBuilder.cardLibrary')}
          </h2>
          <div className="flex-1 overflow-hidden">
            <CardBrowser key={factionCode ?? initialFaction} initialFaction={factionCode ?? initialFaction} />
          </div>
        </div>

        <div className="hidden md:flex flex-[1] flex-col p-4 overflow-hidden">
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

        {/* ── Mobile : onglet actif seulement ── */}
        <div className={`flex-1 flex-col p-3 overflow-hidden ${mobileTab === 'cards' ? 'flex' : 'hidden'} md:hidden`}>
          <div className="flex-1 overflow-hidden">
            <CardBrowser key={factionCode ?? initialFaction} initialFaction={factionCode ?? initialFaction} />
          </div>
        </div>

        <div className={`flex-1 flex-col p-3 overflow-hidden ${mobileTab === 'deck' ? 'flex' : 'hidden'} md:hidden`}>
          <div className="flex-1 overflow-hidden">
            <DeckPanel />
          </div>
        </div>

      </main>

      {/* ── Tab bar mobile ── */}
      <div className="md:hidden shrink-0 flex border-t-2 border-c-border-subtle bg-c-surface shadow-[0_-2px_8px_rgba(0,0,0,0.15)]">
        <button
          onClick={() => setMobileTab('cards')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-sm font-medium transition-colors border-t-2 -mt-[2px] ${
            mobileTab === 'cards'
              ? 'border-primary-500 text-primary-500'
              : 'border-transparent text-c-text-muted'
          }`}
        >
          <i className="fa-solid fa-list text-lg" />
          {t('deckBuilder.cardLibrary')}
        </button>

        <button
          onClick={() => setMobileTab('deck')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-sm font-medium transition-colors border-t-2 -mt-[2px] relative ${
            mobileTab === 'deck'
              ? 'border-primary-500 text-primary-500'
              : 'border-transparent text-c-text-muted'
          }`}
        >
          <span className="relative">
            <i className="fa-solid fa-layer-group text-lg" />
            {playableCount > 0 && (
              <span className="absolute -top-2 -right-3.5 bg-primary-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {playableCount}
              </span>
            )}
          </span>
          {t('deckBuilder.myDeck')}
        </button>
      </div>

    </div>
  );
}
