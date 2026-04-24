'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/hooks/useAuth';
import { saveDeck } from '@/lib/api/deckApi';
import { verifyCardReferences } from '@/lib/api/cardApi';
import LoginButton from '@/components/auth/LoginButton';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';

interface AlteredCard {
  reference: string;
  name: string;
  quantity: number;
  cardType: string;
  imagePath: string | null;
  elements: Record<string, string>;
}

interface AlteredDeck {
  name: string;
  format: string;
  hero: AlteredCard;
  cards: AlteredCard[];
}

function parseAlteredJson(data: unknown): AlteredDeck[] {
  if (!Array.isArray(data)) throw new Error('Le fichier doit contenir un tableau de decks.');

  return data.map((deckItem: Record<string, unknown>) => {
    const inner = (deckItem.data ?? deckItem) as Record<string, unknown>;
    if (!inner) throw new Error('Structure de deck invalide.');

    const alterator = inner.alterator as Record<string, unknown> | undefined;
    const deckCardsByType = inner.deckCardsByType as Record<string, { deckUserListCard?: Array<Record<string, unknown>> }> | undefined;

    if (!alterator || !deckCardsByType) {
      throw new Error('alterator ou deckCardsByType manquant');
    }

    const hero: AlteredCard = {
      reference: (alterator.reference as string) ?? '',
      name: (alterator.name as string) ?? '',
      quantity: 1,
      cardType: 'HERO',
      imagePath: (alterator.imagePath as string) ?? null,
      elements: (alterator.elements as Record<string, string>) ?? {},
    };

    const cards: AlteredCard[] = [];

    for (const [type, section] of Object.entries(deckCardsByType)) {
      const sectionData = section as { deckUserListCard?: Array<Record<string, unknown>> } | undefined;
      if (!sectionData?.deckUserListCard) continue;

      for (const item of sectionData.deckUserListCard) {
        const card = item.card as Record<string, unknown>;
        if (!card) continue;

        cards.push({
          reference: (card.reference as string) ?? '',
          name: (card.name as string) ?? '',
          quantity: (item.quantity as number) ?? 1,
          cardType: type.toUpperCase(),
          imagePath: (card.imagePath as string) ?? null,
          elements: (card.elements as Record<string, string>) ?? {},
        });
      }
    }

    return {
      name: (inner.name as string) ?? 'Deck sans nom',
      format: (inner.eventFormat as string) ?? '',
      hero,
      cards,
    };
  });
}

export default function ImportFromAlteredPage() {
  const t = useTranslations('importAltered');
  const tc = useTranslations('common');
  const router = useRouter();
  const { token, isLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [decks, setDecks] = useState<AlteredDeck[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<(string | null)[]>([]);
  const [savingAll, setSavingAll] = useState(false);
  const [verifiedRefs, setVerifiedRefs] = useState<Map<string, boolean>>(new Map());
  const [verifying, setVerifying] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setParseError(null);
    setDecks([]);
    setSelectedIndex(0);
    setSaveError(null);

    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.name.endsWith('.json')) {
      setFileError('Le fichier doit être un fichier JSON (.json)');
      return;
    }

    setFile(f);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        const parsedDecks = parseAlteredJson(json);
        setDecks(parsedDecks);
        handleVerify(parsedDecks);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Impossible de lire le fichier JSON.');
      }
    };
    reader.readAsText(f);
  };

  const handleUrlImport = async () => {
    const match = urlInput.match(/https?:\/\/(?:www\.)?altered\.(?:gg|com)\/en-us\/decks\/(\w+)/i);
    const id = match?.[1] ?? urlInput.trim();
    if (!id) {
      setParseError(t('urlError'));
      return;
    }

    setLoadingUrl(true);
    setParseError(null);

    try {
      const res = await fetch(`https://api.altered.gg/deck_user_lists/${id}`);
      if (!res.ok) throw new Error(t('deckNotFound'));

      const json = await res.json();
      const parsedDecks = parseAlteredJson([json]);
      setDecks(parsedDecks);
      setUrlInput('');
      handleVerify(parsedDecks);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : t('loadError'));
    } finally {
      setLoadingUrl(false);
    }
  };

  const handleVerify = async (decksToVerify?: AlteredDeck[]) => {
    const target = decksToVerify ?? decks;
    if (target.length === 0) return;
    setVerifying(true);
    setVerifiedRefs(new Map());

    const allRefs = target.flatMap((d) => [
      d.hero.reference,
      ...d.cards.map((c) => c.reference),
    ]);

    const uniqueRefs = [...new Set(allRefs.filter(Boolean))];

    try {
      const { found } = await verifyCardReferences(uniqueRefs);
      const refMap = new Map<string, boolean>();
      uniqueRefs.forEach((ref) => {
        refMap.set(ref, found.includes(ref));
      });
      setVerifiedRefs(refMap);
    } catch (err) {
      console.error('[verify] error:', err);
      setSaveError(t('verifyError'));
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    const deck = decks[selectedIndex];
    if (!deck || !token) return;

    setSaving(true);
    setSaveError(null);

    try {
      const deckCards = [
        { cardReference: deck.hero.reference, quantity: 1 },
        ...deck.cards.map((c) => ({ cardReference: c.reference, quantity: c.quantity })),
      ];

      const result = await saveDeck({
        name: deck.name,
        format: deck.format || null,
        isPublic: false,
        deckCards,
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

    for (let i = 0; i < decks.length; i++) {
      const deck = decks[i];
      try {
        const deckCards = [
          { cardReference: deck.hero.reference, quantity: 1 },
          ...deck.cards.map((c) => ({ cardReference: c.reference, quantity: c.quantity })),
        ];
        const result = await saveDeck({
          name: deck.name,
          format: deck.format || null,
          isPublic: false,
          deckCards,
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
    <div className="min-h-screen bg-c-bg flex flex-col">
      <header className="flex items-center gap-3 px-6 py-3 bg-c-surface border-b border-c-border-subtle">
        <Link href="/decks" className="text-c-text-muted hover:text-c-text transition text-sm">
          ← Mes decks
        </Link>
        <span className="text-c-border">|</span>
        <span className="text-sm font-bold text-c-text">{t('title')}</span>
        <div className="ml-auto flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
          <LoginButton />
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-20 py-8 flex flex-col gap-6">
        <div className="bg-c-surface border border-c-border rounded-lg p-5">
          <h2 className="text-lg font-bold text-c-text mb-3">{t('howTo')}</h2>
          <ol className="flex flex-col gap-2 text-sm text-c-text-secondary list-decimal list-inside">
            <li>{t('step1')}</li>
            <li>{t.rich('step2', { settings: (c) => <strong className="text-c-text">{c}</strong> })}</li>
            <li>{t.rich('step3', {
              export: (c) => <strong className="text-c-text">{c}</strong>,
              format: (c) => <strong className="text-c-text">{c}</strong>,
            })}</li>
            <li>{t('step4')}</li>
            <li>{t('step5')}</li>
            <li>{t.rich('step6', { import: (c) => <strong className="text-c-text">{c}</strong> })}</li>
          </ol>
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
              <label className="text-sm text-c-text-muted">{t('urlLabel')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlImport()}
                  placeholder={t('urlPlaceholder')}
                  className="flex-1 bg-c-elevated border border-c-border rounded-lg px-3 py-2 text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleUrlImport}
                  disabled={loadingUrl || !urlInput.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50"
                >
                  {loadingUrl ? '...' : t('urlImport')}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs text-c-text-subtle">ou</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm text-c-text-muted">{t('fileLabel')}</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="block w-full text-sm text-c-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-100 dark:file:bg-purple-900/40 file:text-purple-700 dark:file:text-purple-400 hover:file:bg-purple-200 dark:hover:file:bg-purple-800/60 cursor-pointer"
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
                        <option key={i} value={i}>
                          {d.name} — {d.hero.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="bg-c-surface border border-c-border rounded-lg p-5 flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-c-text text-lg">{deck.name}</h3>
                      <p className="text-sm text-c-text-muted">
                        {deck.cards.reduce((s, c) => s + c.quantity, 0) + 1} cartes
                        {deck.format && ` — Format: ${deck.format}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
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
                        className="px-5 py-2 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition disabled:opacity-50"
                      >
                        {saving ? '...' : t('save')}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
                    <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 border-b border-c-border pb-1">
                      <span className="w-10 text-right">{t('colQty')}</span>
                      <span className="w-24">{t('colType')}</span>
                      <span className="w-48">{t('colRef')}</span>
                      <span className="flex-1">{t('colName')}</span>
                      <span className="w-16 text-right">{t('colCost')}</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-purple-300 font-medium py-1">
                      <span className="w-10 text-right">×1</span>
                      <span className="w-24">{t('hero')}</span>
                      <span className="w-48 font-mono text-c-text-subtle">{deck.hero.reference}</span>
                      <span className={`flex-1 truncate ${!verifiedRefs.get(deck.hero.reference) ? 'text-red-400' : ''}`}>
                        {deck.hero.name}
                        {!verifiedRefs.get(deck.hero.reference) && verifiedRefs.size > 0 && (
                          <span className="ml-2 text-red-500">✗</span>
                        )}
                      </span>
                      <span className="w-16 text-right text-c-text-muted">
                        {deck.hero.elements.MAIN_COST?.replace(/#/g, '') ?? '—'}
                      </span>
                    </div>

                    {deck.cards.map((card, i) => {
                      const isNotFound = verifiedRefs.size > 0 && !verifiedRefs.get(card.reference);
                      return (
                        <div key={i} className={`flex items-center gap-2 text-xs py-0.5 ${isNotFound ? 'bg-red-900/30 text-red-400' : 'text-c-text-secondary'}`}>
                          <span className="w-10 text-right font-mono">×{card.quantity}</span>
                          <span className="w-24 text-c-text-muted">{card.cardType}</span>
                          <span className="w-48 font-mono text-c-text-subtle">{card.reference}</span>
                          <span className="flex-1 truncate">
                            {card.name}
                            {isNotFound && <span className="ml-2 text-red-500">✗</span>}
                          </span>
                          <span className="w-16 text-right text-c-text-muted">
                            {card.elements.MAIN_COST?.replace(/#/g, '') ?? '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-c-text-muted border-t border-c-border pt-4">
                    <span>
                      <strong className="text-c-text">{deck.cards.filter((c) => c.cardType === 'CHARACTER').reduce((s, c) => s + c.quantity, 0)}</strong> {t('characters')}
                    </span>
                    <span>
                      <strong className="text-c-text">{deck.cards.filter((c) => c.cardType === 'SPELL').reduce((s, c) => s + c.quantity, 0)}</strong> {t('spells')}
                    </span>
                    <span>
                      <strong className="text-c-text">{deck.cards.filter((c) => c.cardType === 'SITUATION').reduce((s, c) => s + c.quantity, 0)}</strong> {t('situations')}
                    </span>
                  </div>

                  {decks.length > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-4 border-t border-c-border">
                      {savedIds.length > 0 && (
                        <span className="text-sm text-green-400">{t('savedCount', { saved: savedIds.length, total: decks.length })}</span>
                      )}
                      {saveError && <span className="text-sm text-red-400">{saveError}</span>}
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
    </div>
  );
}
