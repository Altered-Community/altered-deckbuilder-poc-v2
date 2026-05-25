'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { useDeckStore } from '@/store/deckStore';
import { MIN_DECK_SIZE } from '@/lib/types/constants';
import { fetchFormats } from '@/lib/api/deckApi';
import { getUniqueLimit } from '@/lib/utils/format';
import { getRarityFromSlug, getCardReference, getCardGroupImage, getCardGroupName } from '@/lib/utils/card';
import UniqueCardRenderer from '@/components/cards/UniqueCardRenderer';
import DeckCardItem from './DeckCardItem';
import DeckStats from './DeckStats';
import SaveDeckButton from './SaveDeckButton';

function LimitBadge({ current, max, label, colorOver = 'text-red-400', colorOk = 'text-c-text-muted' }: {
  current: number;
  max: number | null;
  label: string;
  colorOver?: string;
  colorOk?: string;
}) {
  if (max == null) return null;
  const over = current > max;
  return (
    <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${over ? 'bg-red-900/40' : 'bg-c-input'}`}>
      <span className={`tabular-nums font-bold ${over ? colorOver : colorOk}`}>{current}</span>
      <span className={over ? colorOver : colorOk}>/ {max} {label}</span>
    </div>
  );
}

export default function DeckPanel() {
  const t = useTranslations('deck');
  const locale = useLocale();
  const { deck, setDeckName, setFormat, clearDeck, deckStats } = useDeckStore();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(deck.name);
  const [activeTab, setActiveTab] = useState<'cards' | 'stats'>('cards');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const allDeckCards = deck.cards;

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setLightboxIdx(i => i !== null && i > 0 ? i - 1 : i);
      if (e.key === 'ArrowRight') setLightboxIdx(i => i !== null && i < allDeckCards.length - 1 ? i + 1 : i);
      if (e.key === 'Escape')     setLightboxIdx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, allDeckCards.length]);

  const { data: formats = [] } = useQuery({
    queryKey: ['formats'],
    queryFn: fetchFormats,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!formats.length || !deck.format) return;
    const fresh = formats.find((f) => f.code === deck.format!.code);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(deck.format)) setFormat(fresh);
  }, [formats, deck.format, setFormat]);

  const { rareCount, uniqueCount, exaltedCount, playableCount } = deckStats();
  const format = deck.format;
  const minCards = format?.minCards ?? MIN_DECK_SIZE;
  const maxCards = format?.maxCards ?? null;
  const { hasDeckViolations } = useDeckStore();
  const isValid = !!deck.hero && playableCount >= minCards && (maxCards == null || playableCount <= maxCards) && !hasDeckViolations();

  const maxR = format?.limits.rare ?? null;
  const maxU = format ? getUniqueLimit(format, deck.hero?.name ?? null) : null;
  const maxE = format?.limits.exalted ?? null;

  const handleNameSubmit = () => {
    if (nameInput.trim()) setDeckName(nameInput.trim());
    setEditingName(false);
  };

  const groupedCards = deck.cards.reduce<Record<string, typeof deck.cards>>(
    (acc, dc) => {
      const type = dc.cardGroup.cardType?.reference ?? 'OTHER';
      if (!acc[type]) acc[type] = [];
      acc[type].push(dc);
      return acc;
    },
    {}
  );

  const selectClass = 'flex-1 px-2 py-1 bg-c-input border border-c-border rounded text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="flex flex-col h-full bg-c-surface rounded-xl border border-c-border overflow-hidden">
      <div className="px-3 py-2.5 border-b border-c-border bg-c-elevated">
        <div className="flex items-center gap-2 mb-2">
          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              className="flex-1 bg-transparent text-c-text font-bold border-b border-blue-500 outline-none text-sm"
            />
          ) : (
            <button
              onClick={() => { setNameInput(deck.name); setEditingName(true); }}
              className="flex-1 text-left text-c-text font-bold hover:text-blue-500 truncate text-sm"
              title={t('renameTooltip')}
            >
              {deck.name}
            </button>
          )}
          <SaveDeckButton />
          <button
            onClick={() => { if (confirm(t('clearConfirm'))) clearDeck(); }}
            className="shrink-0 text-xs bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/60 text-red-600 dark:text-red-400 px-2 py-1 rounded border border-red-300 dark:border-red-800/50 transition"
          >
            {t('clearDeck')}
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <select
            value={format?.code ?? ''}
            onChange={(e) => {
              const f = formats.find((f) => f.code === e.target.value) ?? null;
              setFormat(f);
            }}
            className={selectClass}
          >
            <option value="">{t('formatPlaceholder')}</option>
            {formats.map((f) => (
              <option key={f.code} value={f.code}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
            playableCount < minCards || (maxCards != null && playableCount > maxCards)
              ? 'bg-red-900/40 text-red-400'
              : 'bg-green-900/40 text-green-400'
          }`}>
            <span className="tabular-nums font-bold">{playableCount}</span>
            <span>/ {minCards}{maxCards != null ? `–${maxCards}` : '+'}</span>
          </div>

          {maxR != null && <LimitBadge current={rareCount} max={maxR} label="R" colorOver="text-red-400" />}
          {maxU != null && <LimitBadge current={uniqueCount} max={maxU} label="U" colorOver="text-red-400" />}
          {maxE != null && <LimitBadge current={exaltedCount} max={maxE} label="E" colorOver="text-red-400" />}

          {isValid && <span className="text-xs text-green-400 ml-auto">{t('valid')}</span>}
        </div>
      </div>

      <div className="flex border-b border-c-border bg-c-elevated">
        {(['cards', 'stats'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-c-text border-b-2 border-blue-500'
                : 'text-c-text-subtle hover:text-c-text-secondary'
            }`}
          >
            {tab === 'cards' ? t('cardsTab', { count: playableCount }) : t('statsTab')}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'stats' ? (
          <DeckStats />
        ) : deck.cards.length === 0 && !deck.hero ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-c-text-muted">
            <span className="text-4xl">🃏</span>
            <p className="text-sm text-center">{t('emptyHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {deck.hero && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-c-text-muted uppercase tracking-wide px-1">{t('hero')}</p>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-yellow-100/80 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700/50">
                  <span className="text-yellow-500 dark:text-yellow-400 text-sm">★</span>
                  <span className="flex-1 text-sm text-yellow-800 dark:text-yellow-200">{deck.hero.name}</span>
                  <button
                    onClick={() => useDeckStore.getState().setHero(null)}
                    className="text-c-text-muted hover:text-red-400 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {Object.entries(groupedCards).map(([type, cards]) => (
              <div key={type} className="flex flex-col gap-1">
                <p className="text-xs text-c-text-muted uppercase tracking-wide px-1">
                  {t(`typeLabels.${type}`, { default: type })}
                  <span className="ml-1 text-c-text-subtle">
                    ({cards.reduce((s, dc) => s + dc.quantity, 0)})
                  </span>
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {cards.map((dc) => {
                    const idx = allDeckCards.findIndex(c => c.cardGroup.slug === dc.cardGroup.slug);
                    return (
                      <DeckCardItem key={dc.cardGroup.slug} deckCard={dc} onZoom={() => setLightboxIdx(idx)} />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {lightboxIdx !== null && (() => {
        const dc = allDeckCards[lightboxIdx];
        if (!dc) return null;
        const rarity    = getRarityFromSlug(dc.cardGroup.slug);
        const reference = getCardReference(dc.cardGroup);
        const image     = rarity !== 'UNIQUE' ? getCardGroupImage(dc.cardGroup, locale) : null;
        const name      = getCardGroupName(dc.cardGroup);
        return (
          <div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center" style={{ zIndex: 9999 }}
            onClick={() => setLightboxIdx(null)}
          >
            <div onClick={(e) => e.stopPropagation()}>
              {rarity === 'UNIQUE' ? (
                <div style={{ width: 'min(52vh, 88vw)' }}>
                  <UniqueCardRenderer reference={reference} locale={locale} className="w-full" />
                </div>
              ) : image ? (
                <div className="relative" style={{ height: '85vh', aspectRatio: '744/1039' }}>
                  <Image src={image} alt={name} fill className="object-contain" unoptimized sizes="600px" />
                </div>
              ) : (
                <div className="flex items-center justify-center bg-c-surface rounded-xl p-8" style={{ height: '60vh', aspectRatio: '744/1039' }}>
                  <span className="text-white text-sm text-center">{name}</span>
                </div>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => i !== null ? Math.max(0, i - 1) : i); }}
              disabled={lightboxIdx === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white disabled:opacity-20 transition"
            >
              <i className="fa-solid fa-chevron-left text-base" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => i !== null ? Math.min(allDeckCards.length - 1, i + 1) : i); }}
              disabled={lightboxIdx === allDeckCards.length - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white disabled:opacity-20 transition"
            >
              <i className="fa-solid fa-chevron-right text-base" />
            </button>
            <button
              onClick={() => setLightboxIdx(null)}
              className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
            >
              <i className="fa-solid fa-xmark" />
            </button>
            <div className="absolute bottom-5 left-0 right-0 text-center pointer-events-none">
              <span className="text-white text-sm font-semibold drop-shadow">{name}</span>
              <span className="text-white/40 text-xs ml-3">{lightboxIdx + 1} / {allDeckCards.length}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
