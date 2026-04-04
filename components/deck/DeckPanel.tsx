'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDeckStore } from '@/store/deckStore';
import { MIN_DECK_SIZE } from '@/lib/types/constants';
import { fetchFormats } from '@/lib/api/deckApi';
import { getUniqueLimit } from '@/lib/utils/format';
import DeckCardItem from './DeckCardItem';
import DeckStats from './DeckStats';
import SaveDeckButton from './SaveDeckButton';

const TYPE_LABELS: Record<string, string> = {
  CHARACTER: 'Personnages',
  SPELL: 'Sorts',
  PERMANENT: 'Permanents',
  LANDMARK_PERMANENT: 'Hauts lieux',
  EXPEDITION_PERMANENT: 'Expéditions',
  TOKEN: 'Tokens',
  TOKEN_MANA: 'Tokens mana',
  OTHER: 'Autres',
};

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
  const { deck, setDeckName, setFormat, clearDeck, deckStats } = useDeckStore();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(deck.name);
  const [activeTab, setActiveTab] = useState<'cards' | 'stats'>('cards');

  const { data: formats = [] } = useQuery({
    queryKey: ['formats'],
    queryFn: fetchFormats,
    staleTime: Infinity,
  });

  const { rareCount, uniqueCount, exaltedCount, playableCount } = deckStats();
  const format = deck.format;
  const minCards = format?.minCards ?? MIN_DECK_SIZE;
  const maxCards = format?.maxCards ?? null;
  const isValid = !!deck.hero && playableCount >= minCards && (maxCards == null || playableCount <= maxCards);

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
      {/* Header */}
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
              title="Cliquer pour renommer"
            >
              {deck.name}
            </button>
          )}
          <SaveDeckButton />
          <button
            onClick={() => { if (confirm('Vider le deck ?')) clearDeck(); }}
            className="shrink-0 text-xs bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/60 text-red-600 dark:text-red-400 px-2 py-1 rounded border border-red-300 dark:border-red-800/50 transition"
          >
            Vider
          </button>
        </div>

        {/* Format selector */}
        <div className="flex items-center gap-2 mb-2">
          <select
            value={format?.code ?? ''}
            onChange={(e) => {
              const f = formats.find((f) => f.code === e.target.value) ?? null;
              setFormat(f);
            }}
            className={selectClass}
          >
            <option value="">— Format —</option>
            {formats.map((f) => (
              <option key={f.code} value={f.code}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Récap format-aware */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Total cartes */}
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

          {isValid && <span className="text-xs text-green-400 ml-auto">✓ Valide</span>}
        </div>
      </div>

      {/* Tabs */}
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
            {tab === 'cards' ? `Cartes (${playableCount})` : 'Stats'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'stats' ? (
          <DeckStats />
        ) : deck.cards.length === 0 && !deck.hero ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-c-text-muted">
            <span className="text-4xl">🃏</span>
            <p className="text-sm text-center">Cliquez sur une carte pour l&apos;ajouter</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {deck.hero && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-c-text-muted uppercase tracking-wide px-1">Héros</p>
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
                  {TYPE_LABELS[type] ?? type}
                  <span className="ml-1 text-c-text-subtle">
                    ({cards.reduce((s, dc) => s + dc.quantity, 0)})
                  </span>
                </p>
                {cards.map((dc) => (
                  <DeckCardItem key={dc.cardGroup.slug} deckCard={dc} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
