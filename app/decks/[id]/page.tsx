'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDeckDetail, getDeckDetailPublic, patchDeck, fetchFormats } from '@/lib/api/deckApi';
import type { ApiDeckDetail, ApiDeckCard } from '@/lib/types/deck';
import { cardGroupFromDeckCard, getCardGroupFaction } from '@/lib/utils/card';
import DeckDetailStats from '@/components/deck/DeckDetailStats';
import SiteLayout from '@/components/layout/SiteLayout';
import { useDeckStore } from '@/store/deckStore';
import { FACTION_BADGE_COLORS, CARD_TYPE_LABELS } from '@/lib/types/constants';

const TYPE_ORDER = ['HERO', 'CHARACTER', 'SPELL', 'PERMANENT', 'LANDMARK_PERMANENT', 'EXPEDITION_PERMANENT', 'TOKEN', 'TOKEN_MANA'];

function getFactionCode(heroRef: string | undefined): string | null {
  if (!heroRef) return null;
  const parts = heroRef.split('_');
  return parts.length > 3 ? parts[3] : null;
}

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

function CardRow({ dc, onClick }: { dc: ApiDeckCard; onClick: () => void }) {
  const name = dc.name ?? dc.cardReference;
  const image = dc.imagePath;

  return (
    <div
      onClick={onClick}
      className="relative rounded-lg overflow-hidden border border-c-border bg-c-surface aspect-[2/3] cursor-pointer hover:brightness-110 hover:scale-[1.02] transition-all duration-100 select-none"
    >
      {image && (
        <Image src={image} alt={name} className="absolute inset-0 w-full h-full object-cover" fill sizes="(max-width: 768px) 50vw, 33vw" />
      )}
      <span className="absolute top-1.5 right-1.5 z-10 text-sm font-bold text-white bg-black/70 px-2 py-0.5 rounded-full shadow">
        x{dc.quantity}
      </span>
    </div>
  );
}

function ListRow({ dc, onClick }: { dc: ApiDeckCard; onClick: () => void }) {
  const name = dc.name ?? dc.cardReference;
  const faction = dc.factionCode ?? '';
  const badge = FACTION_BADGE_COLORS[faction] ?? 'bg-gray-600';

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 py-1.5 border-b border-c-border-subtle last:border-0 cursor-pointer hover:bg-c-elevated transition-colors rounded px-1 -mx-1"
    >
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
  const router = useRouter();
  const groups = groupByType(deckCards);
  if (deckCards.length === 0) return <p className="text-c-text-subtle text-sm">{t('noCards')}</p>;

  const openCard = (ref: string) => router.push(`/cards/${ref}`);

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
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
              {g.cards.map((dc) => (
                <CardRow key={dc.cardReference} dc={dc} onClick={() => openCard(dc.cardReference)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col">
              {g.cards.map((dc) => (
                <ListRow key={dc.cardReference} dc={dc} onClick={() => openCard(dc.cardReference)} />
              ))}
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
  const locale = useLocale();
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
    const fetcher = token ? getDeckDetail(id, locale) : getDeckDetailPublic(id, locale);
    fetcher
      .then((d) => {
        setDeck(d);
        setName(d.name);
        setDescription(d.description ?? '');
        setFormat(d.format ?? '');
        setIsPublic(d.isPublic);
      })
      .catch((e) => setError(e instanceof Error ? e.message : tc('unknownError')))
      .finally(() => setLoading(false));
  }, [id, token, locale, tc]);

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

  const heroImage   = deck?.stats?.hero?.imagePath ?? null;
  const heroName    = deck?.stats?.hero?.name ?? null;
  const factionCode = getFactionCode(deck?.stats?.hero?.reference);
  const totalCards  = deck?.cards.reduce((s, dc) => s + dc.quantity, 0) ?? 0;

  const inputClass = 'w-full bg-c-surface border border-c-border rounded-lg px-3 py-2 text-c-text text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';

  const bannerStyle: React.CSSProperties = heroImage
    ? {
        borderTop: '3px solid var(--primary-400)',
        backgroundImage: `linear-gradient(to right, rgba(140,67,42,0.50) 35%, rgba(140,67,42,0.05) 100%), url(${heroImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'left -460px',
      }
    : { borderTop: '3px solid var(--primary-400)' };

  return (
    <SiteLayout>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        {/* ── En-tête ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/decks" className="text-c-text-muted hover:text-c-text transition">
              {tn('backMyDecks')}
            </Link>
            <span className="text-c-border">›</span>
            <span className="font-bold text-c-text truncate max-w-xs">
              {loading ? '…' : (deck?.name ?? '')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {loadError && <span className="text-xs text-red-400">{loadError}</span>}
            <button
              onClick={handleOpenInBuilder}
              disabled={loadingBuilder}
              className="btn-primary-altered btn-sm disabled:opacity-40"
              style={{ background: 'var(--primary-500, var(--primary-400))' }}
            >
              <i className="fa-solid fa-pen-to-square" />
              {loadingBuilder ? '…' : t('builder')}
            </button>
          </div>
        </div>

        {/* ── États ── */}
        {loading && <p className="text-c-text-muted text-sm">{tc('loading')}</p>}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && deck && (
          <>
            {/* ── Bannière héro ── */}
            <div className="news-card" style={bannerStyle}>
              <div className="news-card-body">
                <div className="flex flex-wrap gap-1 items-center">
                  {deck.format && (
                    <span className="ac-badge" style={{ background: 'var(--primary-400)', color: '#fff' }}>
                      {deck.format}
                    </span>
                  )}
                  <span
                    className="ac-badge ml-auto"
                    style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.12)', color: '#444' }}
                  >
                    <i className={`fa-solid ${deck.isPublic ? 'fa-globe' : 'fa-lock'}`} />
                    {deck.isPublic ? tc('public') : tc('private')}
                  </span>
                </div>

                <h1 className="news-card-title">
                  {factionCode && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://alteredcore.org/assets/faction/${factionCode}.png`}
                      alt={factionCode}
                      style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
                    />
                  )}
                  {deck.name}
                </h1>
                {heroName && (
                  <p style={{ fontSize: '.8rem', opacity: 0.75, color: '#fff', margin: 0 }}>{heroName}</p>
                )}
              </div>
            </div>

            {/* ── Contenu principal ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

              {/* Cartes (2/3) */}
              <div className="lg:col-span-2 card-altered p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest">
                    {t('cards', { count: totalCards })}
                  </h2>
                  <div className="flex border border-c-border rounded-lg overflow-hidden">
                    {(['cards', 'list'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setCardView(v)}
                        className={`px-3 py-1 text-xs transition ${cardView === v ? 'bg-c-input text-c-text font-semibold' : 'text-c-text-subtle hover:text-c-text-secondary'}`}
                      >
                        {v === 'cards' ? t('byType') : t('list')}
                      </button>
                    ))}
                  </div>
                </div>
                <DeckCards deckCards={deck.cards} view={cardView} />
              </div>

              {/* Sidebar droite (1/3) */}
              <div className="flex flex-col gap-4">

                {/* Formulaire — uniquement si connecté */}
                {token && (
                  <div className="card-altered p-4 flex flex-col gap-4">
                    <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest">{t('info')}</h2>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-c-text-muted">{t('name')}</label>
                      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} className={inputClass} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-c-text-muted">{t('description')}</label>
                      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass + ' resize-none'} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-c-text-muted">{t('format')}</label>
                      <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputClass}>
                        <option value="">{tc('noFormat')}</option>
                        {formats.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                      </select>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => setIsPublic((v) => !v)}
                        className={`w-9 h-5 rounded-full transition-colors ${isPublic ? 'bg-amber-500' : 'bg-c-input'} relative`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-4' : ''}`} />
                      </div>
                      <span className="text-sm text-c-text-muted">{t('public')}</span>
                    </label>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={handleSave}
                        disabled={saving || !name.trim()}
                        className="btn-primary-altered btn-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {saving ? tc('saving') : tc('save')}
                      </button>
                      {saved && <span className="text-sm text-green-600 dark:text-green-400 font-medium">{tc('saved')}</span>}
                      {saveError && <span className="text-xs text-red-500">{saveError}</span>}
                    </div>
                  </div>
                )}

                {/* Statistiques */}
                <div className="card-altered overflow-hidden">
                  <div className="px-4 py-3 border-b border-c-border-subtle">
                    <h2 className="text-xs font-semibold text-c-text-muted uppercase tracking-widest">{t('statsTitle')}</h2>
                  </div>
                  <DeckDetailStats cards={deck.cards} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </SiteLayout>
  );
}
