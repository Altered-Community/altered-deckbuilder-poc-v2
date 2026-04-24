'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDeckDetail, patchDeck, fetchFormats } from '@/lib/api/deckApi';
import type { ApiDeckDetail, ApiDeckCard } from '@/lib/types/deck';
import { cardGroupFromDeckCard, getCardGroupFaction, getRarityFromSlug } from '@/lib/utils/card';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import DeckDetailStats from '@/components/deck/DeckDetailStats';
import { useDeckStore } from '@/store/deckStore';
import { FACTION_BADGE_COLORS, CARD_TYPE_LABELS } from '@/lib/types/constants';

const TYPE_ORDER = ['HERO', 'CHARACTER', 'SPELL', 'PERMANENT', 'LANDMARK_PERMANENT', 'EXPEDITION_PERMANENT', 'TOKEN', 'TOKEN_MANA'];

function groupByType(deckCards: ApiDeckCard[]) {
  const groups: Record<string, ApiDeckCard[]> = {};
  for (const dc of deckCards) {
    const type = dc.cardTypeReference ?? 'OTHER';
    if (!groups[type]) groups[type] = [];
    groups[type].push(dc);
  }
  return TYPE_ORDER
    .filter((t) => groups[t]?.length)
    .map((t) => ({ type: t, label: CARD_TYPE_LABELS[t] ?? t, cards: groups[t] }));
}

function CardRow({ dc }: { dc: ApiDeckCard }) {
  const name = dc.name ?? dc.cardReference;
  const faction = dc.factionCode ?? '';
  const badge = FACTION_BADGE_COLORS[faction] ?? 'bg-gray-600';
  const rarity = getRarityFromSlug(dc.cardReference);
  const image = dc.imagePath;

  return (
    <div className="relative rounded-lg overflow-hidden border border-c-border bg-c-surface aspect-[2/3] flex flex-col justify-end">
      {image && (
        <img src={image} alt={name} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/20 to-transparent" />
      <div className="relative z-10 px-2 pb-2 flex flex-col gap-0.5">
        <span className="text-xs text-white font-medium leading-tight line-clamp-2">{name}</span>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {faction && (
              <span className={`text-[9px] font-bold px-1 rounded text-white ${badge}`}>{faction}</span>
            )}
            {dc.mainCost != null && (
              <span className="text-[10px] font-mono bg-gray-800/80 text-white rounded px-1">{dc.mainCost}</span>
            )}
            <span className="text-[9px] text-gray-400">{rarity.charAt(0)}</span>
          </div>
          <span className="text-xs font-bold text-white bg-gray-800/80 px-1.5 rounded">×{dc.quantity}</span>
        </div>
      </div>
    </div>
  );
}

function ListRow({ dc }: { dc: ApiDeckCard }) {
  const name = dc.name ?? dc.cardReference;
  const faction = dc.factionCode ?? '';
  const badge = FACTION_BADGE_COLORS[faction] ?? 'bg-gray-600';

  return (
    <div className="flex items-center gap-2 py-1 border-b border-c-border-subtle last:border-0">
      {faction && (
        <span className={`text-[9px] font-bold px-1 rounded text-white shrink-0 ${badge}`}>
          {faction}
        </span>
      )}
      <span className="w-4 text-xs text-c-text-muted text-right shrink-0">{dc.quantity}×</span>
      <span className="flex-1 text-xs text-c-text-secondary">{name}</span>
      <span className="text-[10px] text-c-text-subtle font-mono shrink-0">{dc.cardReference}</span>
    </div>
  );
}

function DeckCards({ deckCards, view }: { deckCards: ApiDeckCard[]; view: 'cards' | 'list' }) {
  const t = useTranslations('deckEdit');
  const groups = groupByType(deckCards);
  if (deckCards.length === 0) return <p className="text-c-text-subtle text-sm">{t('noCards')}</p>;

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g, i) => (
        <div key={g.type}>
          {i > 0 && <hr className="border-c-border-subtle mb-6" />}
          <p className="text-xs font-semibold text-c-text-muted uppercase tracking-widest mb-2">
            {g.label}
            <span className="ml-1.5 text-c-text-subtle font-normal normal-case">
              ({g.cards.reduce((s, dc) => s + dc.quantity, 0)})
            </span>
          </p>
          {view === 'cards' ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {g.cards.map((dc) => <CardRow key={dc.cardReference} dc={dc} />)}
            </div>
          ) : (
            <div className="flex flex-col">
              {g.cards.map((dc) => <ListRow key={dc.cardReference} dc={dc} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function DeckEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('deckEdit');
  const tc = useTranslations('common');
  const tn = useTranslations('nav');
  const { token } = useAuth();

  const [deck, setDeck] = useState<ApiDeckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const { data: formats = [] } = useQuery({ queryKey: ['formats'], queryFn: fetchFormats, staleTime: Infinity });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loadingBuilder, setLoadingBuilder] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cardView, setCardView] = useState<'cards' | 'list'>('cards');

  useEffect(() => {
    if (!token) return;
    getDeckDetail(id)
      .then((d) => {
        setDeck(d);
        setName(d.name);
        setDescription(d.description ?? '');
        setFormat(d.format ?? '');
        setIsPublic(d.isPublic);
      })
      .catch((e) => setError(e instanceof Error ? e.message : tc('unknownError')))
      .finally(() => setLoading(false));
  }, [id, token, tc]);

  const handleOpenInBuilder = async () => {
    if (!deck) return;
    setLoadingBuilder(true);
    setLoadError(null);
    try {
      const heroDc = deck.cards.find((dc) => dc.cardTypeReference === 'HERO');
      const hero = heroDc ? cardGroupFromDeckCard(heroDc) : null;
      const cards = deck.cards
        .filter((dc) => dc.cardTypeReference !== 'HERO')
        .map((dc) => ({ cardGroup: cardGroupFromDeckCard(dc), quantity: dc.quantity }));

      useDeckStore.setState({
        deck: {
          id: crypto.randomUUID(),
          apiId: deck.id,
          name: deck.name,
          format: formats.find((f) => f.code === deck.format) ?? null,
          hero,
          cards,
          createdAt: deck.createdAt,
          updatedAt: deck.updatedAt ?? deck.createdAt,
        },
      });

      const faction = hero ? getCardGroupFaction(hero) : null;
      router.push(faction ? `/deck?faction=${faction}` : '/deck');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : tc('unknownError'));
      setLoadingBuilder(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await patchDeck(id, { name: name.trim(), description: description.trim() || null, format: format || null, isPublic });
      setSaved(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : tc('unknownError'));
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-c-elevated border border-c-border rounded-lg px-3 py-2 text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="h-screen bg-c-bg flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-6 py-3 bg-c-surface border-b border-c-border-subtle">
        <Link href="/decks" className="text-c-text-muted hover:text-c-text transition text-sm">{tn('backMyDecks')}</Link>
        <span className="text-c-border">|</span>
        <span className="text-sm font-bold text-c-text">{loading ? '...' : (deck?.name ?? t('editing'))}</span>
        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {!token && <p className="text-red-400 text-sm p-6">{t('mustLogin')}</p>}
        {token && loading && <p className="text-c-text-muted text-sm p-6">{tc('loading')}</p>}
        {token && error && <p className="text-red-400 text-sm p-6">{error}</p>}

        {token && !loading && deck && (
          <>
            {/* ── Colonne gauche : formulaire ── */}
            <div className="w-80 shrink-0 flex flex-col border-r border-c-border-subtle">
              <div className="h-12 shrink-0 flex items-center justify-between px-5 border-b border-c-border-subtle">
                <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest">{t('info')}</h2>
                <div className="flex items-center gap-2">
                  {loadError && <span className="text-xs text-red-400">{loadError}</span>}
                  <button
                    onClick={handleOpenInBuilder}
                    disabled={loadingBuilder}
                    className="text-xs px-2 py-1 bg-yellow-900/40 hover:bg-yellow-800/60 text-yellow-400 hover:text-yellow-300 rounded border border-yellow-800/50 transition disabled:opacity-40"
                  >
                    {loadingBuilder ? '...' : t('builder')}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-c-text-muted">{t('name')}</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} className={inputClass} />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-c-text-muted">{t('description')}</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass + ' resize-none'} />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-c-text-muted">{t('format')}</label>
                  <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputClass}>
                    <option value="">{tc('noFormat')}</option>
                    {formats.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div onClick={() => setIsPublic((v) => !v)} className={`w-9 h-5 rounded-full transition-colors ${isPublic ? 'bg-blue-600' : 'bg-c-input'} relative`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isPublic ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-sm text-c-text-muted">{t('public')}</span>
                </label>

                <div className="flex items-center gap-3">
                  <button onClick={handleSave} disabled={saving || !name.trim()} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                    {saving ? tc('saving') : tc('save')}
                  </button>
                  {saved && <span className="text-sm text-green-400">{tc('saved')}</span>}
                  {saveError && <span className="text-xs text-red-400">{saveError}</span>}
                </div>
              </div>
            </div>

            {/* ── Colonne centrale : cartes ── */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="h-12 shrink-0 flex items-center justify-between px-5 border-b border-c-border-subtle">
                <span className="text-xs font-semibold text-c-text-muted uppercase tracking-widest">
                  {t('cards', { count: deck.cards.reduce((s, dc) => s + dc.quantity, 0) })}
                </span>
                <div className="flex border border-c-border rounded-lg overflow-hidden">
                  {(['cards', 'list'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setCardView(v)}
                      className={`px-3 py-1 text-xs transition ${cardView === v ? 'bg-c-input text-c-text' : 'text-c-text-subtle hover:text-c-text-secondary'}`}
                    >
                      {v === 'cards' ? t('byType') : t('list')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <DeckCards deckCards={deck.cards} view={cardView} />
              </div>
            </div>

            {/* ── Colonne droite : statistiques ── */}
            <div className="w-72 shrink-0 flex flex-col border-l border-c-border-subtle bg-c-elevated">
              <div className="h-12 shrink-0 flex items-center px-5 border-b border-c-border-subtle">
                <span className="text-xs font-semibold text-c-text-muted uppercase tracking-widest">
                  {t('statsTitle')}
                </span>
              </div>
              <div className="flex-1 overflow-hidden">
                <DeckDetailStats cards={deck.cards} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
