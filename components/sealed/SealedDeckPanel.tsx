'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useSealedStore, SEALED_MIN_DECK_SIZE } from '@/store/sealedStore';
import { getRarityFromSlug, getCardReference, getCardGroupImage, getCardGroupName } from '@/lib/utils/card';
import { FACTION_BADGE_COLORS } from '@/lib/types/constants';
import UniqueCardRenderer from '@/components/cards/UniqueCardRenderer';
import SealedHeroModal from './SealedHeroModal';
import SealedSaveDeckButton from './SealedSaveDeckButton';

export default function SealedDeckPanel() {
  const t = useTranslations('sealed');
  const locale = useLocale();
  const { deck, setDeckName, clearDeck, decrementCard, removeCard, playableCount, deckFactions, isValid } = useSealedStore();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(deck.name);
  const [showHeroModal, setShowHeroModal] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const count = playableCount();
  const factions = deckFactions();
  const valid = isValid();

  const handleNameSubmit = () => {
    if (nameInput.trim()) setDeckName(nameInput.trim());
    setEditingName(false);
  };

  const allCards = deck.cards;

  const groupedCards = deck.cards.reduce<Record<string, typeof deck.cards>>(
    (acc, dc) => {
      const type = dc.cardGroup.cardType?.reference ?? 'OTHER';
      if (!acc[type]) acc[type] = [];
      acc[type].push(dc);
      return acc;
    },
    {}
  );

  const TYPE_LABELS: Record<string, string> = {
    CHARACTER: t('typeLabels.CHARACTER'),
    SPELL: t('typeLabels.SPELL'),
    PERMANENT: t('typeLabels.PERMANENT'),
    LANDMARK_PERMANENT: t('typeLabels.LANDMARK_PERMANENT'),
    TOKEN: t('typeLabels.TOKEN'),
    OTHER: t('typeLabels.OTHER'),
  };

  return (
    <div className="flex flex-col h-full bg-c-surface rounded-xl border border-c-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-c-border bg-c-elevated space-y-2">
        <div className="flex items-center gap-2">
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
          <SealedSaveDeckButton />
          <button
            onClick={() => { if (confirm(t('clearConfirm'))) clearDeck(); }}
            className="shrink-0 text-xs bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/60 text-red-600 dark:text-red-400 px-2 py-1 rounded border border-red-300 dark:border-red-800/50 transition"
          >
            {t('clearDeck')}
          </button>
        </div>

        {/* Card count indicator */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
            count < SEALED_MIN_DECK_SIZE ? 'bg-red-900/40 text-red-400' : 'bg-green-900/40 text-green-400'
          }`}>
            <span className="tabular-nums font-bold">{count}</span>
            <span>/ {SEALED_MIN_DECK_SIZE}+</span>
          </div>
          {valid && <span className="text-xs text-green-400">{t('valid')}</span>}
          {factions.length > 0 && (
            <div className="flex items-center gap-1 ml-auto">
              {factions.map((f) => (
                <span key={f} className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${FACTION_BADGE_COLORS[f] ?? 'bg-gray-600'}`}>
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Hero */}
        <button
          onClick={() => setShowHeroModal(true)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-sm text-left transition ${
            deck.hero
              ? 'bg-yellow-100/80 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700/50 text-yellow-800 dark:text-yellow-200'
              : 'border-dashed border-c-border text-c-text-muted hover:border-c-text-muted hover:text-c-text'
          }`}
        >
          <span className={deck.hero ? 'text-yellow-500' : 'text-c-text-muted'}>★</span>
          <span className="flex-1 truncate">
            {deck.hero ? deck.hero.name : t('chooseHero')}
          </span>
          {deck.hero && (
            <span className={`text-[9px] font-bold px-1 rounded text-white ${FACTION_BADGE_COLORS[deck.hero.faction?.code ?? ''] ?? 'bg-gray-600'}`}>
              {deck.hero.faction?.code}
            </span>
          )}
          <i className="fa-solid fa-chevron-right text-xs opacity-50" />
        </button>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto p-3">
        {deck.cards.length === 0 && !deck.hero ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-c-text-muted">
            <span className="text-4xl">🃏</span>
            <p className="text-sm text-center">{t('emptyHint')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {Object.entries(groupedCards).map(([type, cards]) => (
              <div key={type} className="flex flex-col gap-1">
                <p className="text-xs text-c-text-muted uppercase tracking-wide px-1">
                  {TYPE_LABELS[type] ?? type}
                  <span className="ml-1 text-c-text-subtle">
                    ({cards.reduce((s, dc) => s + dc.quantity, 0)})
                  </span>
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {cards.map((dc) => {
                    const idx = allCards.findIndex((c) => c.cardGroup.slug === dc.cardGroup.slug);
                    return (
                      <SealedDeckCardItem
                        key={dc.cardGroup.slug}
                        deckCard={dc}
                        onZoom={() => setLightboxIdx(idx)}
                        onDecrement={() => decrementCard(dc.cardGroup.slug)}
                        onRemove={() => removeCard(dc.cardGroup.slug)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (() => {
        const dc = allCards[lightboxIdx];
        if (!dc) return null;
        const rarity = getRarityFromSlug(dc.cardGroup.slug);
        const reference = getCardReference(dc.cardGroup);
        const image = rarity !== 'UNIQUE' ? getCardGroupImage(dc.cardGroup, locale) : null;
        const name = getCardGroupName(dc.cardGroup);
        return (
          <div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50"
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
                <div className="flex items-center justify-center bg-c-surface rounded-xl p-8 h-64">
                  <span className="text-white text-sm text-center">{name}</span>
                </div>
              )}
            </div>
            <button onClick={() => setLightboxIdx(null)} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        );
      })()}

      {showHeroModal && <SealedHeroModal onClose={() => setShowHeroModal(false)} />}
    </div>
  );
}

function SealedDeckCardItem({ deckCard, onZoom, onDecrement, onRemove }: {
  deckCard: { cardGroup: import('@/lib/types/card').CardGroup; quantity: number };
  onZoom: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  const locale = useLocale();
  const { canAddCard, addCard, pool } = useSealedStore();
  const card = deckCard.cardGroup;
  const name = getCardGroupName(card);
  const image = getCardGroupImage(card, locale);
  const rarity = getRarityFromSlug(card.slug);
  const factionCode = card.faction?.code ?? '';
  const factionBadge = FACTION_BADGE_COLORS[factionCode] ?? 'bg-gray-600';
  const poolQty = pool.find((p) => p.cardGroup.slug === card.slug)?.quantity ?? deckCard.quantity;
  const canAdd = canAddCard(card) === null;

  return (
    <div className="relative group rounded-lg border border-c-border overflow-hidden bg-c-surface text-xs">
      <div className="relative aspect-[744/1039] bg-c-elevated">
        {rarity === 'UNIQUE' ? (
          <div className="w-full h-full">
            <UniqueCardRenderer reference={getCardReference(card)} className="w-full h-full" />
          </div>
        ) : image ? (
          <Image src={image} alt={name} fill className="object-cover" sizes="100px" unoptimized />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-1">
            <span className="text-[9px] text-c-text-muted text-center">{name}</span>
          </div>
        )}

        {/* Qty badge */}
        <div className="absolute top-1 right-1 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {deckCard.quantity}
        </div>

        {/* Hover controls */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onZoom(); }}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center"
          >
            <i className="fa-solid fa-magnifying-glass text-xs" />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onDecrement(); }}
              className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center"
            >
              <i className="fa-solid fa-minus text-xs" />
            </button>
            {canAdd && deckCard.quantity < poolQty && (
              <button
                onClick={(e) => { e.stopPropagation(); addCard(card); }}
                className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/30 text-white flex items-center justify-center"
              >
                <i className="fa-solid fa-plus text-xs" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="w-7 h-7 rounded-full bg-red-600/60 hover:bg-red-600/80 text-white flex items-center justify-center"
            >
              <i className="fa-solid fa-trash text-xs" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-1 py-0.5 flex items-center gap-1 bg-c-surface">
        {factionCode && (
          <span className={`text-[8px] font-bold px-0.5 rounded text-white shrink-0 ${factionBadge}`}>
            {factionCode}
          </span>
        )}
        <span className="text-[9px] text-c-text-secondary truncate flex-1">{name}</span>
      </div>
    </div>
  );
}
