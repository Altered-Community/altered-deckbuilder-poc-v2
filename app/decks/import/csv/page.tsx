'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/lib/hooks/useAuth';
import { saveDeck } from '@/lib/api/deckApi';
import { verifyCardReferences } from '@/lib/api/cardApi';
import LoginButton from '@/components/auth/LoginButton';
import SiteFooter from '@/components/layout/SiteFooter';

interface CsvCard {
  reference: string;
  name: string;
  quantity: number;
}

interface CsvDeck {
  id: string;
  name: string;
  format: string;
  hero: { reference: string; name: string };
  cards: CsvCard[];
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuote = !inQuote;
    } else if (c === ';' && !inQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): CsvDeck[] {
  const clean = text.replace(/^﻿/, '');
  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) throw new Error('Le fichier CSV est vide ou invalide.');

  const header = parseCsvLine(lines[0]);
  const idx = {
    deck_id: header.indexOf('deck_id'),
    deck_name: header.indexOf('deck_name'),
    deck_format: header.indexOf('deck_format'),
    hero_reference: header.indexOf('hero_reference'),
    hero_name: header.indexOf('hero_name'),
    card_reference: header.indexOf('card_reference'),
    card_name: header.indexOf('card_name'),
    quantity: header.indexOf('quantity'),
  };

  const missing = Object.entries(idx).filter(([, v]) => v === -1).map(([k]) => k);
  if (missing.length > 0) throw new Error(`Colonnes manquantes : ${missing.join(', ')}`);

  const deckMap = new Map<string, CsvDeck>();
  const deckOrder: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 8) continue;

    const deckId = cols[idx.deck_id];
    const cardRef = cols[idx.card_reference];
    if (!deckId || !cardRef) continue;

    if (!deckMap.has(deckId)) {
      deckMap.set(deckId, {
        id: deckId,
        name: cols[idx.deck_name],
        format: cols[idx.deck_format],
        hero: { reference: cols[idx.hero_reference], name: cols[idx.hero_name] },
        cards: [],
      });
      deckOrder.push(deckId);
    }

    deckMap.get(deckId)!.cards.push({
      reference: cardRef,
      name: cols[idx.card_name],
      quantity: parseInt(cols[idx.quantity], 10) || 1,
    });
  }

  if (deckOrder.length === 0) throw new Error('Aucun deck trouvé dans le fichier CSV.');
  return deckOrder.map((id) => deckMap.get(id)!);
}

export default function ImportFromCsvPage() {
  const t = useTranslations('importCsv');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { token, isLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileError, setFileError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [decks, setDecks] = useState<CsvDeck[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<(string | null)[]>([]);
  const [savingAll, setSavingAll] = useState(false);
  const [verifiedRefs, setVerifiedRefs] = useState<Map<string, boolean>>(new Map());
  const [verifying, setVerifying] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setParseError(null);
    setDecks([]);
    setSelectedIndex(0);
    setSaveError(null);
    setVerifiedRefs(new Map());

    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.name.endsWith('.csv')) {
      setFileError(t('fileTypeError'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsedDecks = parseCsv(text);
        setDecks(parsedDecks);
        handleVerify(parsedDecks);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : t('parseError'));
      }
    };
    reader.readAsText(f);
  };

  const handleVerify = async (decksToVerify?: CsvDeck[]) => {
    const target = decksToVerify ?? decks;
    if (target.length === 0) return;
    setVerifying(true);
    setVerifiedRefs(new Map());

    const allRefs = target.flatMap((d) => [d.hero.reference, ...d.cards.map((c) => c.reference)]);
    const uniqueRefs = [...new Set(allRefs.filter(Boolean))];

    try {
      const { found } = await verifyCardReferences(uniqueRefs, locale);
      const refMap = new Map<string, boolean>();
      uniqueRefs.forEach((ref) => refMap.set(ref, found.includes(ref)));
      setVerifiedRefs(refMap);
    } catch (err) {
      console.error('[verify] error:', err);
      setSaveError(t('verifyError'));
    } finally {
      setVerifying(false);
    }
  };

  const buildDeckCards = (deck: CsvDeck) => [
    { cardReference: deck.hero.reference, quantity: 1 },
    ...deck.cards.map((c) => ({ cardReference: c.reference, quantity: c.quantity })),
  ];

  const handleSave = async () => {
    const deck = decks[selectedIndex];
    if (!deck || !token) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveDeck({
        name: deck.name,
        format: deck.format || null,
        isPublic: false,
        deckCards: buildDeckCards(deck),
      });
      router.push(`/decks/${result.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : tc('unknownError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    setSaveError(null);
    const saved: (string | null)[] = [];
    let localError: string | null = null;

    for (const deck of decks) {
      try {
        const result = await saveDeck({
          name: deck.name,
          format: deck.format || null,
          isPublic: false,
          deckCards: buildDeckCards(deck),
        });
        saved.push(result.id);
        setSavedIds([...saved]);
      } catch (err) {
        localError = `Erreur sur "${deck.name}": ${err instanceof Error ? err.message : tc('unknownError')}`;
        setSaveError(localError);
        break;
      }
    }

    setSavingAll(false);
    if (saved.length > 0 && !localError) {
      setTimeout(() => router.push('/decks'), 1500);
    }
  };

  const inputClass =
    'w-full bg-c-elevated border border-c-border rounded-lg px-3 py-2 text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  const deck = decks[selectedIndex];

  return (
    <div className="flex flex-col" style={{ flex: 1 }}>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6">
        <div className="bg-c-surface border border-c-border rounded-lg p-5">
          <h2 className="text-lg font-bold text-c-text mb-2">{t('howTo')}</h2>
          <p className="text-sm text-c-text-secondary">{t('howToDesc')}</p>
        </div>

        {isLoading && (
          <div className="text-center text-c-text-muted mt-8">
            <p>{tc('loading')}</p>
          </div>
        )}

        {!isLoading && !token && (
          <div className="text-center text-c-text-muted mt-8">
            <p className="mb-4">{t('loginRequired')}</p>
            <LoginButton />
          </div>
        )}

        {!isLoading && token && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-c-text-muted">{t('fileLabel')}</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-c-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-100 dark:file:bg-green-900/40 file:text-green-700 dark:file:text-green-400 hover:file:bg-green-200 dark:hover:file:bg-green-800/60 cursor-pointer"
              />
              {fileError && <p className="text-xs text-red-400">{fileError}</p>}
            </div>

            {parseError && (
              <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
                <p className="text-sm text-red-400">{parseError}</p>
              </div>
            )}

            {deck && (
              <>
                {decks.length > 1 && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-c-text-muted">{t('selectDeck')}</label>
                    <select
                      value={selectedIndex}
                      onChange={(e) => setSelectedIndex(Number(e.target.value))}
                      className={inputClass}
                    >
                      {decks.map((d, i) => (
                        <option key={d.id} value={i}>
                          {d.name} — {d.hero.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="bg-c-surface border border-c-border rounded-lg p-5 flex flex-col gap-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-c-text text-lg">{deck.name}</h3>
                      <p className="text-sm text-c-text-muted">
                        {deck.cards.reduce((s, c) => s + c.quantity, 0) + 1} cartes
                        {deck.format && ` — Format : ${deck.format}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {saveError && <span className="text-xs text-red-400 max-w-[200px]">{saveError}</span>}
                      <button
                        onClick={() => handleVerify()}
                        disabled={verifying}
                        className="px-4 py-2 text-sm bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition disabled:opacity-50"
                      >
                        {verifying ? '...' : t('verify')}
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg transition disabled:opacity-50"
                      >
                        {saving ? '...' : t('save')}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="flex flex-col gap-1 max-h-96 overflow-y-auto min-w-[400px]">
                      <div className="flex items-center gap-2 text-xs font-semibold text-green-400 border-b border-c-border pb-1">
                        <span className="w-10 text-right">{t('colQty')}</span>
                        <span className="hidden sm:block w-48">{t('colRef')}</span>
                        <span className="flex-1">{t('colName')}</span>
                        <span className="w-14 text-right">{t('colStatus')}</span>
                      </div>

                      {/* Hero row */}
                      <div className="flex items-center gap-2 text-xs text-green-300 font-medium py-1">
                        <span className="w-10 text-right">×1</span>
                        <span className="hidden sm:block w-48 font-mono text-c-text-subtle">{deck.hero.reference}</span>
                        <span className={`flex-1 truncate ${verifiedRefs.size > 0 && !verifiedRefs.get(deck.hero.reference) ? 'text-red-400' : ''}`}>
                          {deck.hero.name}
                        </span>
                        <span className="w-14 text-right text-xs">
                          {verifiedRefs.size > 0
                            ? verifiedRefs.get(deck.hero.reference)
                              ? <span className="text-green-400">✓</span>
                              : <span className="text-red-400">✗</span>
                            : <span className="text-c-text-muted">{t('hero')}</span>}
                        </span>
                      </div>

                      {/* Card rows */}
                      {deck.cards.map((card, i) => {
                        const isNotFound = verifiedRefs.size > 0 && !verifiedRefs.get(card.reference);
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-2 text-xs py-0.5 ${isNotFound ? 'bg-red-900/30 text-red-400' : 'text-c-text-secondary'}`}
                          >
                            <span className="w-10 text-right font-mono">×{card.quantity}</span>
                            <span className="hidden sm:block w-48 font-mono text-c-text-subtle">{card.reference}</span>
                            <span className="flex-1 truncate">{card.name}</span>
                            <span className="w-14 text-right text-xs">
                              {verifiedRefs.size > 0
                                ? isNotFound
                                  ? <span className="text-red-400">✗</span>
                                  : <span className="text-green-400">✓</span>
                                : null}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {decks.length > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-4 border-t border-c-border flex-wrap">
                      {savedIds.length > 0 && (
                        <span className="text-sm text-green-400">
                          {t('savedCount', { saved: savedIds.length, total: decks.length })}
                        </span>
                      )}
                      <button
                        onClick={handleSaveAll}
                        disabled={savingAll}
                        className="px-5 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg transition disabled:opacity-50"
                      >
                        {savingAll ? tc('saving') : t('saveAll', { count: decks.length })}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
