'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useDeckStore } from '@/store/deckStore';
import { saveDeck, patchDeck } from '@/lib/api/deckApi';
import { getCardReference } from '@/lib/utils/card';
import { MIN_DECK_SIZE } from '@/lib/types/constants';

export default function SaveDeckButton() {
  const { token } = useAuth();
  const { deck, deckStats, setApiId } = useDeckStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!token) return null;

  const { playableCount } = deckStats();
  const isValid = !!deck.hero && playableCount >= MIN_DECK_SIZE;

  const buildDeckCards = () => {
    const deckCards: { cardReference: string; quantity: number }[] = [];
    if (deck.hero) deckCards.push({ cardReference: getCardReference(deck.hero), quantity: 1 });
    for (const dc of deck.cards) {
      deckCards.push({ cardReference: getCardReference(dc.cardGroup), quantity: dc.quantity });
    }
    return deckCards;
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const deckCards = buildDeckCards();
      const format = deck.format?.code ?? null;

      if (deck.apiId) {
        await patchDeck(deck.apiId, { name: deck.name, format, deckCards });
      } else {
        const result = await saveDeck({ name: deck.name, format, isPublic: false, deckCards });
        setApiId(result.id);
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-400 truncate max-w-[160px]" title={error}>{error}</span>}
      {saved && !error && <span className="text-xs text-green-400">✓</span>}
      <button
        onClick={handleSave}
        disabled={loading || !isValid}
        className="shrink-0 text-xs bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/60 text-blue-700 dark:text-blue-400 px-2 py-1 rounded border border-blue-300 dark:border-blue-800/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        title={!isValid ? `Deck invalide (héros + ${MIN_DECK_SIZE} cartes min)` : deck.apiId ? 'Mettre à jour le deck' : 'Sauvegarder le deck'}
      >
        {loading ? '...' : deck.apiId ? 'Mettre à jour' : 'Sauvegarder'}
      </button>
    </div>
  );
}
