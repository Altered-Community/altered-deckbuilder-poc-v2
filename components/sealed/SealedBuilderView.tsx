'use client';

import { useState, useSyncExternalStore } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import SealedCardBrowser from './SealedCardBrowser';
import SealedDeckPanel from './SealedDeckPanel';
import { useSealedStore } from '@/store/sealedStore';
import { fetchCardGroups } from '@/lib/api/cardApi';
import { getCardGroupImage, getCardGroupName, getRarityFromSlug, getCardReference } from '@/lib/utils/card';
import UniqueCardRenderer from '@/components/cards/UniqueCardRenderer';
import type { CardGroup } from '@/lib/types/card';

async function fetchRandomUnique(setRef: string, locale: string): Promise<CardGroup | null> {
  // 1ère requête : récupérer le total
  const meta = await fetchCardGroups({
    'set.reference': setRef,
    rarity: 'UNIQUE',
    excludeCardTypes: ['HERO'],
    itemsPerPage: 1,
    page: 1,
  }, locale);

  const total = meta.pagination.totalItems;
  if (!total) return null;

  // 2ème requête : page aléatoire (1 carte par page = index direct)
  const randomPage = Math.floor(Math.random() * total) + 1;
  const result = await fetchCardGroups({
    'set.reference': setRef,
    rarity: 'UNIQUE',
    excludeCardTypes: ['HERO'],
    itemsPerPage: 1,
    page: randomPage,
  }, locale);

  return result.data[0] ?? null;
}

export default function SealedBuilderView() {
  const t = useTranslations('sealed');
  const locale = useLocale();
  const { pool, clearPool, playableCount, selectedSet, uniqueDrawsAvailable, uniqueDrawsUsed, addToPool } = useSealedStore();
  const count = playableCount();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [mobileTab, setMobileTab] = useState<'pool' | 'deck'>('pool');
  const [drawingUnique, setDrawingUnique] = useState(false);
  const [drawnCard, setDrawnCard] = useState<CardGroup | null>(null);

  const drawsRemaining = uniqueDrawsAvailable - uniqueDrawsUsed;
  const canDraw = drawsRemaining > 0 && !!selectedSet && !drawingUnique;

  const handleDrawUnique = async () => {
    if (!canDraw || !selectedSet) return;
    setDrawingUnique(true);
    setDrawnCard(null);
    try {
      const card = await fetchRandomUnique(selectedSet, locale);
      if (card) {
        addToPool(card);
        setDrawnCard(card);
        setTimeout(() => setDrawnCard(null), 4000);
      }
    } finally {
      setDrawingUnique(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - var(--nav-h))', minHeight: 0 }}>
      {/* Sub-bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-c-surface border-b border-c-border-subtle text-xs flex-wrap">
        <span className="font-semibold text-c-text">{t('formatLabel')}</span>
        <span className="text-c-text-muted">{t('poolSize', { count: pool.length })}</span>

        {/* Bouton tirage unique */}
        {(drawsRemaining > 0 || drawingUnique) && (
          <button
            onClick={handleDrawUnique}
            disabled={!canDraw}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition
              border-purple-500/60 text-purple-400 hover:bg-purple-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {drawingUnique ? (
              <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-400" />{t('drawingUnique')}</>
            ) : (
              <><i className="fa-solid fa-sparkles" />{t('drawUnique', { count: drawsRemaining })}</>
            )}
          </button>
        )}

        <button
          onClick={() => { if (confirm(t('reopenConfirm'))) clearPool(); }}
          className="ml-auto text-c-text-subtle hover:text-c-text underline transition"
        >
          {t('reopenPacks')}
        </button>
      </div>

      {/* Toast carte unique tirée */}
      {drawnCard && (
        <DrawnUniqueToast card={drawnCard} locale={locale} onClose={() => setDrawnCard(null)} />
      )}

      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Desktop */}
        <div className="hidden md:flex flex-[3] flex-col p-4 border-r border-c-border-subtle overflow-hidden">
          <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest mb-3">
            {t('yourPool')}
          </h2>
          <div className="flex-1 overflow-hidden">
            <SealedCardBrowser />
          </div>
        </div>
        <div className="hidden md:flex flex-[1] flex-col p-4 overflow-hidden">
          <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest mb-3 flex items-center justify-between">
            <span>{t('myDeck')}</span>
            {count > 0 && (
              <span className="text-xs font-bold text-c-text tabular-nums normal-case tracking-normal">{count}</span>
            )}
          </h2>
          <div className="flex-1 overflow-hidden">
            <SealedDeckPanel />
          </div>
        </div>

        {/* Mobile */}
        <div className={`flex-1 flex-col p-3 overflow-hidden ${mobileTab === 'pool' ? 'flex' : 'hidden'} md:hidden`}>
          <div className="flex-1 overflow-hidden">
            <SealedCardBrowser />
          </div>
        </div>
        <div className={`flex-1 flex-col p-3 overflow-hidden ${mobileTab === 'deck' ? 'flex' : 'hidden'} md:hidden`}>
          <div className="flex-1 overflow-hidden">
            <SealedDeckPanel />
          </div>
        </div>
      </main>

      {/* Mobile tab bar */}
      <div className="md:hidden shrink-0 flex border-t-2 border-c-border-subtle bg-c-surface shadow-[0_-2px_8px_rgba(0,0,0,0.15)]">
        <button
          onClick={() => setMobileTab('pool')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-sm font-medium transition-colors border-t-2 -mt-[2px] ${
            mobileTab === 'pool' ? 'border-primary-500 text-primary-500' : 'border-transparent text-c-text-muted'
          }`}
        >
          <i className="fa-solid fa-layer-group text-lg" />
          {t('yourPool')}
        </button>
        <button
          onClick={() => setMobileTab('deck')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-sm font-medium transition-colors border-t-2 -mt-[2px] relative ${
            mobileTab === 'deck' ? 'border-primary-500 text-primary-500' : 'border-transparent text-c-text-muted'
          }`}
        >
          <span className="relative">
            <i className="fa-solid fa-cards text-lg" />
            {count > 0 && (
              <span className="absolute -top-2 -right-3.5 bg-primary-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {count}
              </span>
            )}
          </span>
          {t('myDeck')}
        </button>
      </div>
    </div>
  );
}

function DrawnUniqueToast({ card, locale, onClose }: { card: CardGroup; locale: string; onClose: () => void }) {
  const t = useTranslations('sealed');
  const rarity = getRarityFromSlug(card.slug);
  const reference = getCardReference(card);
  const image = rarity !== 'UNIQUE' ? getCardGroupImage(card, locale) : null;
  const name = getCardGroupName(card);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="flex items-center gap-3 bg-c-surface border border-purple-500/60 rounded-2xl shadow-xl px-4 py-3 max-w-xs">
        <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-purple-400/40 relative">
          {rarity === 'UNIQUE' && reference ? (
            <UniqueCardRenderer reference={reference} locale={locale} className="w-full h-full" />
          ) : image ? (
            <Image src={image} alt={name} fill className="object-cover" unoptimized sizes="48px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-purple-900/30">
              <i className="fa-solid fa-sparkles text-purple-400" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide">{t('uniqueObtained')}</p>
          <p className="text-sm text-c-text font-bold truncate">{name}</p>
        </div>
        <button onClick={onClose} className="shrink-0 text-c-text-muted hover:text-c-text">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>
    </div>
  );
}
