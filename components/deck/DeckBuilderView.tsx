'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CardBrowser from '@/components/cards/CardBrowser';
import DeckPanel from '@/components/deck/DeckPanel';
import LoginButton from '@/components/auth/LoginButton';
import ThemeToggle from '@/components/ThemeToggle';
import { useDeckStore } from '@/store/deckStore';
import { getCardGroupFaction } from '@/lib/utils/card';
import { FACTIONS, FACTION_BADGE_COLORS } from '@/lib/types/constants';

interface Props {
  initialFaction?: string;
}

export default function DeckBuilderView({ initialFaction }: Props) {
  const router = useRouter();
  const hero = useDeckStore((s) => s.deck.hero);
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
    <div className="flex flex-col h-screen">
      <header className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-c-surface border-b border-c-border-subtle">
        <Link href="/" className="text-c-text-muted hover:text-c-text transition text-sm">
          ← Héros
        </Link>
        <span className="text-c-border">|</span>
        <span className="text-sm font-bold text-c-text">Altered</span>
        <span className="text-xs text-c-text-muted">Deck Builder</span>

        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <Link href="/decks" className="text-xs text-c-text-muted hover:text-c-text transition">
            Mes decks
          </Link>
          <LoginButton />
          {factionCode && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${factionBadge}`}>
              {factionCode}
            </span>
          )}
          <span className="text-yellow-500 dark:text-yellow-400 text-sm">★</span>
          <span className="text-sm text-yellow-700 dark:text-yellow-200 font-medium">{hero.name}</span>
          <span className="text-xs text-c-text-muted">{factionName}</span>
          <Link href="/" className="text-xs text-c-text-subtle hover:text-c-text-muted ml-2 underline">
            Changer
          </Link>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-[3] flex flex-col p-4 border-r border-c-border-subtle overflow-hidden">
          <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest mb-3">
            Bibliothèque de cartes
          </h2>
          <div className="flex-1 overflow-hidden">
            <CardBrowser key={factionCode ?? initialFaction} initialFaction={factionCode ?? initialFaction} />
          </div>
        </div>

        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest mb-3">
            Mon Deck
          </h2>
          <div className="flex-1 overflow-hidden">
            <DeckPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
