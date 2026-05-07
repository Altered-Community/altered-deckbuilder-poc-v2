'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDecks, getPublicDecks, deleteDeck } from '@/lib/api/deckApi';
import type { ApiDeck } from '@/lib/types/deck';
import LoginButton from '@/components/auth/LoginButton';
import SiteLayout from '@/components/layout/SiteLayout';
import { FACTIONS } from '@/lib/types/constants';
import { getCdnImageUrl, getRarityFromSlug } from '@/lib/utils/card';

type Tab = 'public' | 'myDecks';

function getFactionCode(heroRef: string | undefined): string | null {
  if (!heroRef) return null;
  const parts = heroRef.split('_');
  return parts.length > 3 ? parts[3] : null;
}

export default function DecksPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('public');

  /* Decks publics */
  const [publicDecks, setPublicDecks] = useState<ApiDeck[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState<string | null>(null);

  /* Mes decks */
  const [myDecks, setMyDecks] = useState<ApiDeck[]>([]);
  const [myLoading, setMyLoading] = useState(true);
  const [myError, setMyError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const mounted = useRef(true);

  /* Filtres */
  const [filterFaction, setFilterFaction] = useState<string | null>(null);
  const [filterHero, setFilterHero] = useState<string | null>(null);
  const [filterFormat, setFilterFormat] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');

  /* Fetch decks publics */
  useEffect(() => {
    mounted.current = true;
    getPublicDecks(locale)
      .then((data) => { if (mounted.current) setPublicDecks(data); })
      .catch((e) => { if (mounted.current) setPublicError(e instanceof Error ? e.message : t('common.unknownError')); })
      .finally(() => { if (mounted.current) setPublicLoading(false); });
    return () => { mounted.current = false; };
  }, [locale, t]);

  /* Fetch mes decks */
  useEffect(() => {
    if (!token) return;
    mounted.current = true;
    getDecks(locale)
      .then((data) => { if (mounted.current) setMyDecks(data); })
      .catch((e) => { if (mounted.current) setMyError(e instanceof Error ? e.message : t('common.unknownError')); })
      .finally(() => { if (mounted.current) setMyLoading(false); });
    return () => { mounted.current = false; };
  }, [token, locale, t]);

  /* Reset filtres au changement de tab */
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setFilterFaction(null);
    setFilterHero(null);
    setFilterFormat('');
    setFilterSearch('');
  };

  const handleFactionClick = (code: string) => {
    const next = filterFaction === code ? null : code;
    setFilterFaction(next);
    setFilterHero(null);
  };

  const activeDecks = activeTab === 'public' ? publicDecks : myDecks;

  const heroesForFaction = useMemo(() => {
    if (!filterFaction) return [];
    const seen = new Set<string>();
    const result: { name: string; imagePath: string | null }[] = [];
    for (const d of activeDecks) {
      const fc = getFactionCode(d.stats?.hero?.reference);
      if (fc !== filterFaction) continue;
      const name = d.stats?.hero?.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const hRef = d.stats?.hero?.reference ?? null;
      const hImg = hRef && getRarityFromSlug(hRef) !== 'UNIQUE' ? getCdnImageUrl(hRef) : (d.stats?.hero?.imagePath ?? null);
      result.push({ name, imagePath: hImg });
    }
    return result;
  }, [activeDecks, filterFaction]);

  const formats = useMemo(() => {
    const seen = new Set<string>();
    return activeDecks
      .filter((d) => d.format && !seen.has(d.format) && seen.add(d.format))
      .map((d) => d.format as string);
  }, [activeDecks]);

  const filtered = useMemo(() => activeDecks.filter((d) => {
    const fc = getFactionCode(d.stats?.hero?.reference);
    if (filterFaction && fc !== filterFaction) return false;
    if (filterHero && d.stats?.hero?.name !== filterHero) return false;
    if (filterFormat && d.format !== filterFormat) return false;
    if (filterSearch && !d.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  }), [activeDecks, filterFaction, filterHero, filterFormat, filterSearch]);

  const hasFilter = !!(filterFaction || filterHero || filterFormat || filterSearch);

  const isLoading = activeTab === 'public' ? publicLoading : (token ? myLoading : false);
  const error = activeTab === 'public' ? publicError : myError;

  return (
    <SiteLayout>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        {/* ── En-tête ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="section-title mb-0">
            <span>{t('decks.title')}</span>
            {activeDecks.length > 0 && (
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--neutral-600)' }}>
                {filtered.length !== activeDecks.length
                  ? `${filtered.length} / ${activeDecks.length}`
                  : `${activeDecks.length} deck${activeDecks.length !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-primary-altered btn-sm">
              <i className="fa-solid fa-plus" />
              {t('decks.newDeck')}
            </Link>
            <Link href="/decks/import/altered" className="btn-primary-altered btn-sm" style={{ background: 'var(--neutral-600)' }}>
              <i className="fa-solid fa-cloud-arrow-down" />
              {t('nav.importFromAltered')}
            </Link>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 border-b border-c-border">
          {(['public', 'myDecks'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-c-text-subtle hover:text-c-text'
              }`}
            >
              {t(tab === 'public' ? 'decks.tabPublic' : 'decks.tabMyDecks')}
            </button>
          ))}
        </div>

        {/* ── Barre de filtres ── */}
        <div className="card-altered p-3 flex flex-col gap-2">
          <div className="filter-row">
            <span className="filter-label">Recherche</span>
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Rechercher un deck…"
              className="px-2 py-1 bg-c-input border border-c-border rounded text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 w-44"
            />
            {formats.length > 0 && (
              <>
                <span className="filter-label" style={{ marginLeft: '0.5rem' }}>Format</span>
                <select
                  value={filterFormat}
                  onChange={(e) => setFilterFormat(e.target.value)}
                  className="px-2 py-1 bg-c-input border border-c-border rounded text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 w-32"
                >
                  <option value="">{t('decks.allFormats')}</option>
                  {formats.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </>
            )}
            {hasFilter && (
              <button
                onClick={() => { setFilterFaction(null); setFilterHero(null); setFilterFormat(''); setFilterSearch(''); }}
                className="ml-auto text-xs text-c-text-subtle hover:text-amber-500 underline transition"
              >
                {t('decks.reset')}
              </button>
            )}
          </div>

          <div className="filter-row">
            <span className="filter-label">Faction</span>
            {Object.entries(FACTIONS).map(([code]) => {
              const active = filterFaction === code;
              return (
                <button
                  key={code}
                  onClick={() => handleFactionClick(code)}
                  className={`filter-toggle${active ? ' active' : ''}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://alteredcore.org/assets/faction/${code}.png`} alt={code} style={{ width: 16, height: 16, objectFit: 'contain' }} />
                  {FACTIONS[code]}
                </button>
              );
            })}
          </div>

          {filterFaction && heroesForFaction.length > 0 && (
            <div className="filter-row" style={{ borderTop: '1px solid var(--c-border-subtle)', paddingTop: '0.4rem' }}>
              <span className="filter-label">Héros</span>
              {heroesForFaction.map(({ name, imagePath }) => {
                const active = filterHero === name;
                return (
                  <button
                    key={name}
                    onClick={() => setFilterHero(active ? null : name)}
                    className={`filter-toggle${active ? ' active' : ''}`}
                  >
                    {imagePath && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagePath} alt={name} style={{ width: 14, height: 18, objectFit: 'cover', borderRadius: 2 }} />
                    )}
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Contenu ── */}
        <div>
          {/* Tab "My Decks" — login requis */}
          {activeTab === 'myDecks' && !token && (
            <div className="text-center mt-20">
              <p className="mb-4" style={{ color: 'var(--neutral-600)' }}>{t('decks.loginRequired')}</p>
              <LoginButton />
            </div>
          )}

          {/* États communs */}
          {(activeTab === 'public' || token) && isLoading && (
            <p className="text-sm" style={{ color: 'var(--neutral-600)' }}>{t('common.loading')}</p>
          )}
          {(activeTab === 'public' || token) && error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* Vide */}
          {activeTab === 'public' && !isLoading && !error && publicDecks.length === 0 && (
            <p className="text-center mt-20 text-sm" style={{ color: 'var(--neutral-600)' }}>{t('decks.noPublicDecks')}</p>
          )}
          {activeTab === 'myDecks' && token && !isLoading && !error && myDecks.length === 0 && (
            <div className="text-center mt-20">
              <p className="mb-4" style={{ color: 'var(--neutral-600)' }}>{t('decks.noDecks')}</p>
              <Link href="/" className="btn-primary-altered">{t('decks.createFirst')}</Link>
            </div>
          )}
          {!isLoading && !error && activeDecks.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-c-text-muted mt-8">Aucun deck ne correspond aux filtres.</p>
          )}

          {/* Grille */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((deck) => {
                const heroRef     = deck.stats?.hero?.reference;
                const heroImage   = heroRef && getRarityFromSlug(heroRef) !== 'UNIQUE' ? getCdnImageUrl(heroRef) : (deck.stats?.hero?.imagePath ?? null);
                const heroName    = deck.stats?.hero?.name ?? null;
                const factionCode = getFactionCode(heroRef);
                const totalCards  = deck.stats?.totalCards ?? 0;
                const commonCount = deck.stats?.byRarity['C'] ?? 0;
                const rareCount   = deck.stats?.byRarity['R'] ?? 0;
                const uniqueCount = deck.stats?.byRarity['U'] ?? 0;

                const cardStyle: React.CSSProperties = heroImage
                  ? {
                      borderTop: '3px solid var(--primary-400)',
                      backgroundImage: `linear-gradient(to right, rgba(140,67,42,0.70) 30%, rgba(140,67,42,0) 100%), url(${heroImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'left -90px',
                    }
                  : { borderTop: '3px solid var(--primary-400)' };

                return (
                  <div key={deck.id} className="news-card" style={{ ...cardStyle, height: 180 }}>
                    <div className="news-card-body">
                      <div className="flex flex-wrap gap-1 items-center">
                        {deck.format && (
                          <span className="ac-badge" style={{ background: 'var(--primary-400)', color: '#fff' }}>
                            {deck.format}
                          </span>
                        )}
                        {factionCode && (
                          <span className="ac-badge" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.12)', color: '#444' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`https://alteredcore.org/assets/faction/${factionCode}.png`} alt={factionCode} style={{ width: 14, height: 14, objectFit: 'contain' }} />
                            {FACTIONS[factionCode] ?? factionCode}
                          </span>
                        )}
                        <span
                          className="ac-badge ml-auto"
                          style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.12)', color: '#444' }}
                        >
                          <i className={`fa-solid ${deck.isPublic ? 'fa-globe' : 'fa-lock'}`} />
                          {deck.isPublic ? t('common.public') : t('common.private')}
                        </span>
                      </div>

                      <h3 className="news-card-title" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)' }}>
                        {deck.name}
                      </h3>

                      {heroName && (
                        <p style={{ fontSize: '.85rem', fontWeight: 700, color: '#fff', margin: 0, textAlign: 'left', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{heroName}</p>
                      )}

                      <div className="mt-auto pt-2 flex items-center gap-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.20)' }}>
                        {/* Boutons edit/delete */}
                        {activeTab === 'myDecks' && (
                          <>
                            <Link href={`/decks/${deck.id}`} className="ac-btn">
                              <i className="fa-solid fa-pen" />
                              {t('decks.edit')}
                            </Link>
                            <button
                              onClick={() => handleDelete(deck)}
                              disabled={deleting === deck.id}
                              className="ac-btn ac-btn-danger"
                              style={{ opacity: deleting === deck.id ? 0.5 : 1 }}
                            >
                              <i className="fa-solid fa-trash" />
                              {deleting === deck.id ? '...' : t('common.delete')}
                            </button>
                          </>
                        )}

                        {/* Gems */}
                        <div className="flex items-center gap-2 flex-1" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                          <span style={{ fontSize: '.875rem', fontWeight: 700, color: '#fff' }}>{totalCards} {t('decks.cards')}</span>
                          {commonCount > 0 && (
                            <span className="flex items-center gap-0.5" style={{ fontSize: '.875rem', fontWeight: 600 }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="https://alteredcore.org/assets/gems/C.png" alt="C" style={{ width: 15, height: 15, objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }} />
                              <span style={{ color: '#fff' }}>{commonCount}</span>
                            </span>
                          )}
                          {rareCount > 0 && (
                            <span className="flex items-center gap-0.5" style={{ fontSize: '.875rem', fontWeight: 600 }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="https://alteredcore.org/assets/gems/R.png" alt="R" style={{ width: 15, height: 15, objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }} />
                              <span style={{ color: '#fff' }}>{rareCount}</span>
                            </span>
                          )}
                          {uniqueCount > 0 && (
                            <span className="flex items-center gap-0.5" style={{ fontSize: '.875rem', fontWeight: 600 }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="https://alteredcore.org/assets/gems/U.png" alt="U" style={{ width: 15, height: 15, objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }} />
                              <span style={{ color: '#fff' }}>{uniqueCount}</span>
                            </span>
                          )}
                        </div>

                        {/* View */}
                        <Link href={`/decks/${deck.id}`} className="btn-primary-altered btn-sm">
                          {t('decks.view')} <i className="fa-solid fa-eye" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SiteLayout>
  );

  function handleDelete(deck: ApiDeck) {
    if (!token) return;
    if (!confirm(t('decks.deleteConfirm', { name: deck.name }))) return;
    setDeleting(deck.id);
    deleteDeck(deck.id)
      .then(() => setMyDecks((prev) => prev.filter((d) => d.id !== deck.id)))
      .catch((e) => setMyError(e instanceof Error ? e.message : t('common.unknownError')))
      .finally(() => setDeleting(null));
  }
}
