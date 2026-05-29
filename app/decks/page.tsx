'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/lib/hooks/useAuth';
import { signIn } from 'next-auth/react';
import { getDecks, getPublicDecks, getPublicHeroes, deleteDeck, upvoteDeck, duplicateDeck } from '@/lib/api/deckApi';

const USE_KEYCLOAK = process.env.NEXT_PUBLIC_USE_KEYCLOAK === 'true';
import type { ApiDeck } from '@/lib/types/deck';
import LoginButton from '@/components/auth/LoginButton';
import SiteLayout from '@/components/layout/SiteLayout';
import { FACTIONS, FACTION_HERO_GRADIENT } from '@/lib/types/constants';
import { getCdnImageUrl, getHeroImageUrl, getRarityFromSlug } from '@/lib/utils/card';

type Tab = 'public' | 'myDecks';

function getFactionCode(heroRef: string | undefined): string | null {
  if (!heroRef) return null;
  const parts = heroRef.split('_');
  return parts.length > 3 ? parts[3] : null;
}

export default function DecksPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('myDecks');

  /* Pagination publique */
  const [publicPage, setPublicPage] = useState(1);
  const [publicLastPage, setPublicLastPage] = useState(1);
  const [publicTotal, setPublicTotal] = useState(0);

  /* Decks publics */
  const [publicDecks, setPublicDecks] = useState<ApiDeck[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState<string | null>(null);

  /* Mes decks — chargés entièrement côté client */
  const [allMyDecks, setAllMyDecks] = useState<ApiDeck[] | null>(null);
  const [myLoading, setMyLoading] = useState(true);
  const [myError, setMyError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [myDecksVersion, setMyDecksVersion] = useState(0);

  /* Héros publics (pour le filtre sur l'onglet public) */
  const [publicHeroes, setPublicHeroes] = useState<{ reference: string; name: string }[]>([]);

  /* Filtres */
  const [filterFaction, setFilterFaction] = useState<string | null>(null);
  const [filterHero, setFilterHero] = useState<string | null>(null);
  const [filterFormat, setFilterFormat] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [filterCardName, setFilterCardName] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent' | 'upvotes' | 'views'>('recent');

  /* Upvotes (optimistic) */
  const [upvoting, setUpvoting] = useState<string | null>(null);

  /* Redirection Keycloak si non authentifié */
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated && USE_KEYCLOAK) {
      signIn('keycloak');
    }
  }, [authLoading, isAuthenticated]);

  /* Héros publics — chargés une seule fois */
  useEffect(() => {
    let active = true;
    getPublicHeroes(locale).then((heroes) => { if (active) setPublicHeroes(heroes.toSorted((a, b) => a.name.localeCompare(b.name))); }).catch(() => {});
    return () => { active = false; };
  }, [locale]);

  /* Fetch decks publics */
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setPublicLoading(true);
      setPublicError(null);
      try {
        const res = await getPublicDecks(locale, publicPage, { cardName: filterCardName || undefined, sortBy, hero: activeTab === 'public' ? (filterHero ?? undefined) : undefined, faction: activeTab === 'public' ? (filterFaction ?? undefined) : undefined });
        if (!active) return;
        setPublicDecks(res.items);
        setPublicLastPage(res.lastPage);
        setPublicTotal(res.totalItems);
      } catch (e) {
        if (active) setPublicError(e instanceof Error ? e.message : t('common.unknownError'));
      } finally {
        if (active) setPublicLoading(false);
      }
    }, filterCardName ? 400 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [locale, publicPage, filterCardName, sortBy, filterHero, filterFaction, activeTab, t]);

  /* Charge tous mes decks (toutes pages) dès l'auth */
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    getDecks(locale, 1).then(async (first) => {
      const all = [...first.items];
      const remaining = Array.from({ length: first.lastPage - 1 }, (_, i) => i + 2);
      const pages = await Promise.all(remaining.map((p) => getDecks(locale, p)));
      for (const p of pages) all.push(...p.items);
      if (active) { setAllMyDecks(all); setMyLoading(false); }
    }).catch((e) => {
      if (active) { setMyError(e instanceof Error ? e.message : t('common.unknownError')); setMyLoading(false); }
    });
    return () => { active = false; };
  }, [isAuthenticated, locale, myDecksVersion, t]);

  /* Reset filtres au changement de tab */
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setFilterFaction(null);
    setFilterHero(null);
    setFilterFormat('');
    setFilterSearch('');
    setFilterCardName('');
    setSortBy('recent');
  };

  const handleUpvote = async (deck: ApiDeck) => {
    if (!isAuthenticated) { signIn('keycloak'); return; }
    if (upvoting) return;
    setUpvoting(deck.id);
    // optimistic update
    setPublicDecks((prev) => prev.map((d) =>
      d.id !== deck.id ? d : {
        ...d,
        upvoteCount: (d.upvoteCount ?? 0) + (d.hasUpvoted ? -1 : 1),
        hasUpvoted: !d.hasUpvoted,
      }
    ));
    try {
      const res = await upvoteDeck(deck.id);
      setPublicDecks((prev) => prev.map((d) =>
        d.id !== deck.id ? d : { ...d, upvoteCount: res.upvoteCount, hasUpvoted: res.hasUpvoted }
      ));
    } catch {
      // revert on error
      setPublicDecks((prev) => prev.map((d) =>
        d.id !== deck.id ? d : { ...d, upvoteCount: deck.upvoteCount, hasUpvoted: deck.hasUpvoted }
      ));
    } finally {
      setUpvoting(null);
    }
  };

  const handleFactionClick = (code: string) => {
    const next = filterFaction === code ? null : code;
    setFilterFaction(next);
    setPublicPage(1);
    if (filterHero) {
      const hero = allHeroes.find((h) => h.reference === filterHero);
      if (next && hero?.factionCode !== next) setFilterHero(null);
    }
  };

  const activeDecks = useMemo(
    () => activeTab === 'public' ? publicDecks : (allMyDecks ?? []),
    [activeTab, publicDecks, allMyDecks],
  );

  const allHeroSeen = new Set<string>();
  const allHeroes: { name: string; reference: string; factionCode: string | null; imagePath: string | null }[] = [];
  for (const d of activeDecks) {
    const name = d.stats?.hero?.name;
    const reference = d.stats?.hero?.reference;
    if (!name || !reference || allHeroSeen.has(reference)) continue;
    allHeroSeen.add(reference);
    const fc = getFactionCode(reference);
    const hImg = getRarityFromSlug(reference) !== 'UNIQUE' ? getCdnImageUrl(reference, locale) : (d.stats?.hero?.imagePath ?? null);
    allHeroes.push({ name, reference, factionCode: fc, imagePath: hImg });
  }
  allHeroes.sort((a, b) => a.name.localeCompare(b.name));

  const heroesForFaction = allHeroes.filter((h) => !filterFaction || h.factionCode === filterFaction);

  const formats = useMemo(() => {
    const seen = new Set<string>();
    return activeDecks
      .filter((d) => d.format && !seen.has(d.format) && seen.add(d.format))
      .map((d) => d.format as string);
  }, [activeDecks]);

  const filtered = useMemo(() => {
    const result = activeDecks.filter((d) => {
      const fc = getFactionCode(d.stats?.hero?.reference);
      if (filterFaction && fc !== filterFaction) return false;
      if (filterHero && d.stats?.hero?.reference !== filterHero) return false;
      if (filterFormat && d.format !== filterFormat) return false;
      if (filterSearch && !d.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      return true;
    });
    if (activeTab === 'myDecks') {
      result.sort((a, b) => {
        const da = a.updatedAt ?? a.createdAt;
        const db = b.updatedAt ?? b.createdAt;
        return db.localeCompare(da);
      });
    }
    return result;
  }, [activeDecks, activeTab, filterFaction, filterHero, filterFormat, filterSearch]);

  const hasFilter = !!(filterFaction || filterHero || filterFormat || filterSearch || filterCardName);

  const currentPage = publicPage;
  const lastPage = activeTab === 'public' ? publicLastPage : 1;
  const totalItems = activeTab === 'public' ? publicTotal : filtered.length;
  const setPage = setPublicPage;

  const isLoading = activeTab === 'public' ? publicLoading : myLoading;
  const error = activeTab === 'public' ? publicError : myError;

  /* Pendant la vérification ou la redirection Keycloak */
  if (USE_KEYCLOAK && (authLoading || !isAuthenticated)) {
    return (
      <SiteLayout>
        <div className="flex items-center justify-center h-64 gap-3 text-c-text-muted">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-400" />
          <span className="text-sm">{authLoading ? t('common.loading') : 'Redirection...'}</span>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        {/* ── En-tête ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="section-title mb-0">
            <span>{t('decks.title')}</span>
            {totalItems > 0 && (
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--neutral-600)' }}>
                {totalItems} deck{totalItems !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" className="btn-primary-altered btn-sm">
              <i className="fa-solid fa-plus" />
              {t('decks.newDeck')}
            </Link>
            <Link href="/decks/import/altered" className="btn-primary-altered btn-sm" style={{ background: 'var(--neutral-600)' }}>
              <i className="fa-solid fa-cloud-arrow-down" />
              {t('nav.importFromAltered')}
            </Link>
            <Link href="/decks/import/csv" className="btn-primary-altered btn-sm" style={{ background: 'var(--neutral-600)' }}>
              <i className="fa-solid fa-file-csv" />
              {t('nav.importFromCsv')}
            </Link>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 border-b border-c-border">
          {(['myDecks', 'public'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-c-text-subtle hover:text-c-text'
              }`}
            >
              <i className={tab === 'myDecks' ? 'fa-solid fa-user' : 'fa-solid fa-globe'} />
              {t(tab === 'myDecks' ? 'decks.tabMyDecks' : 'decks.tabPublic')}
            </button>
          ))}
        </div>

        {/* ── Barre de filtres ── */}
        <div className="card-altered p-3 flex flex-col gap-2">
          <div className="filter-row">
            <span className="filter-label">{t('decks.filterSearchLabel')}</span>
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder={t('decks.searchPlaceholder')}
              className="px-2 py-1 bg-c-input border border-c-border rounded text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 w-36"
            />
            {activeTab === 'public' && (
              <>
                <span className="filter-label" style={{ marginLeft: '0.5rem' }}>
                  <i className="fa-solid fa-layer-group mr-1 opacity-60" />{t('decks.filterCardLabel')}
                </span>
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-2 top-1/2 -translate-y-1/2 text-c-text-muted text-[10px] pointer-events-none" />
                  <input
                    type="text"
                    value={filterCardName}
                    onChange={(e) => { setFilterCardName(e.target.value); setPublicPage(1); }}
                    placeholder={t('decks.filterCardPlaceholder')}
                    className="pl-6 pr-2 py-1 bg-c-input border border-c-border rounded text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 w-40"
                  />
                </div>
              </>
            )}
            {activeTab === 'public' && (
              <>
                <span className="filter-label" style={{ marginLeft: '0.5rem' }}>Tri</span>
                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPublicPage(1); }}
                  className="px-2 py-1 bg-c-input border border-c-border rounded text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="recent">Récents</option>
                  <option value="upvotes">Upvotes</option>
                  <option value="views">Vus</option>
                </select>
              </>
            )}
            {hasFilter && (
              <button
                onClick={() => { setFilterFaction(null); setFilterHero(null); setFilterFormat(''); setFilterSearch(''); setFilterCardName(''); setSortBy('recent'); }}
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
                  <img src={`/faction/${code}.png`} alt={code} style={{ width: 16, height: 16, objectFit: 'contain' }} />
                  {FACTIONS[code]}
                </button>
              );
            })}
          </div>

          {formats.length > 0 && (
            <div className="filter-row">
              <span className="filter-label">Format</span>
              {formats.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterFormat(filterFormat === f ? '' : f)}
                  className={`filter-toggle${filterFormat === f ? ' active' : ''}`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {(() => {
            const heroOptions = activeTab === 'public'
              ? (filterFaction ? publicHeroes.filter((h) => getFactionCode(h.reference) === filterFaction) : publicHeroes)
              : heroesForFaction;
            if (heroOptions.length === 0) return null;
            return (
              <div className="filter-row" style={{ borderTop: '1px solid var(--c-border-subtle)', paddingTop: '0.4rem' }}>
                <span className="filter-label">Héros</span>
                <select
                  value={filterHero ?? ''}
                  onChange={(e) => { setFilterHero(e.target.value || null); setPublicPage(1); }}
                  className="px-2 py-1 bg-c-input border border-c-border rounded text-c-text text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 w-48"
                >
                  <option value="">Tous les héros</option>
                  {heroOptions.map(({ name, reference }) => (
                    <option key={reference} value={reference}>{name}</option>
                  ))}
                </select>
              </div>
            );
          })()}
        </div>

        {/* ── Contenu ── */}
        <div>
          {/* Tab "My Decks" — login requis */}
          {activeTab === 'myDecks' && !authLoading && !isAuthenticated && (
            <div className="text-center mt-20">
              <p className="mb-4" style={{ color: 'var(--neutral-600)' }}>{t('decks.loginRequired')}</p>
              <LoginButton />
            </div>
          )}

          {/* États communs */}
          {(activeTab === 'public' || isAuthenticated) && isLoading && (
            <p className="text-sm" style={{ color: 'var(--neutral-600)' }}>{t('common.loading')}</p>
          )}
          {(activeTab === 'public' || isAuthenticated) && error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* Vide */}
          {activeTab === 'public' && !isLoading && !error && publicDecks.length === 0 && (
            <p className="text-center mt-20 text-sm" style={{ color: 'var(--neutral-600)' }}>{t('decks.noPublicDecks')}</p>
          )}

          {activeTab === 'myDecks' && isAuthenticated && !isLoading && !error && (allMyDecks ?? []).length === 0 && (
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
                const heroImage   = heroRef ? getHeroImageUrl(heroRef) : (deck.stats?.hero?.imagePath ?? null);
                const heroName    = deck.stats?.hero?.name ?? null;
                const factionCode = getFactionCode(heroRef);
                const totalCards    = deck.stats?.totalCards ?? 0;
                const dateLabel    = deck.updatedAt ?? deck.createdAt;

                const gradientColor = factionCode ? (FACTION_HERO_GRADIENT[factionCode] ?? null) : null;
                const cardStyle: React.CSSProperties = heroImage
                  ? {
                      borderTop: `3px solid var(--primary-400)`,
                      backgroundImage: gradientColor
                        ? `linear-gradient(to right, ${gradientColor}cc 30%, ${gradientColor}00 50%), url(${heroImage})`
                        : `url(${heroImage})`,
                      backgroundSize: 'cover',
                    }
                  : { borderTop: '3px solid var(--primary-400)' };

                return (
                  <div key={deck.id} className="news-card" style={{ ...cardStyle, height: 210 }}>
                    <div className="news-card-body">
                      <div className="flex flex-wrap gap-1 items-center">
                        {deck.format && (
                          <span className="ac-badge" style={{ background: 'var(--primary-400)', color: '#fff' }}>
                            {deck.format}
                          </span>
                        )}
                        {deck.legal !== undefined && (
                          <span
                            className="ac-badge"
                            style={deck.legal
                              ? { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.12)', color: '#16a34a' }
                              : { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.12)', color: '#dc2626' }
                            }
                          >
                            <i className={`fa-solid ${deck.legal ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
                            {deck.legal ? t('deckEdit.legalityLegal') : t('deckEdit.legalityIllegal')}
                          </span>
                        )}
                        {factionCode && (
                          <span className="ac-badge" style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.12)', color: '#444' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/faction/${factionCode}.png`} alt={factionCode} style={{ width: 14, height: 14, objectFit: 'contain' }} />
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
                      {dateLabel && (
                        <p style={{ fontSize: '.7rem', opacity: 0.5, color: '#fff', margin: 0 }}>
                          {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(dateLabel))}
                        </p>
                      )}

                      <div className="mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.20)' }}>
                        {/* Ligne 1 : stats */}
                        <div className="pt-2 flex items-center gap-2" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>
                          <span style={{ fontSize: '.875rem', fontWeight: 700, color: '#fff' }}>{totalCards} {t('decks.cards')}</span>
                          {(['C', 'R', 'U', 'E'] as const).map((key) => {
                            const count = deck.stats?.byRarity[key] ?? 0;
                            if (!count) return null;
                            return (
                              <span key={key} className="flex items-center gap-0.5" style={{ fontSize: '.875rem', fontWeight: 600 }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`https://alteredcore.org/assets/gems/${key}.png`} alt={key} style={{ width: 15, height: 15, objectFit: 'contain', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }} />
                                <span style={{ color: '#fff' }}>{count}</span>
                              </span>
                            );
                          })}
                        </div>

                        {/* Ligne 2 : vues + upvotes + boutons */}
                        <div className="pt-1.5 flex items-center gap-2">
                          {/* View count — public seulement */}
                          {activeTab === 'public' && deck.viewCount != null && (
                            <span className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full bg-black/40 text-white backdrop-blur-sm">
                              <i className="fa-solid fa-eye text-xs opacity-80" />
                              {deck.viewCount}
                            </span>
                          )}
                          {/* Upvote — public seulement */}
                          {activeTab === 'public' && (
                            <button
                              onClick={(e) => { e.preventDefault(); handleUpvote(deck); }}
                              disabled={upvoting === deck.id}
                              title={isAuthenticated ? (deck.hasUpvoted ? 'Retirer mon upvote' : 'Upvoter') : 'Se connecter pour upvoter'}
                              className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full transition-all ${
                                deck.hasUpvoted
                                  ? 'bg-amber-400 text-white shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                                  : 'bg-black/40 text-white/90 hover:bg-amber-400/80 hover:text-white backdrop-blur-sm'
                              } disabled:cursor-default`}
                            >
                              <i className={`fa-${deck.hasUpvoted ? 'solid' : 'regular'} fa-thumbs-up text-xs`} />
                              {deck.upvoteCount ?? 0}
                            </button>
                          )}
                          {activeTab === 'myDecks' && (
                            <>
                              <Link href={`/decks/${deck.id}`} className="ac-btn">
                                <i className="fa-solid fa-pencil" />
                                {t('decks.edit')}
                              </Link>
                              <button
                                onClick={() => handleDuplicate(deck)}
                                disabled={duplicating === deck.id}
                                className="ac-btn self-stretch px-2.5"
                                style={{ opacity: duplicating === deck.id ? 0.5 : 1 }}
                                title={t('decks.duplicate')}
                              >
                                {duplicating === deck.id
                                  ? <i className="fa-solid fa-spinner fa-spin" />
                                  : <i className="fa-solid fa-copy" />
                                }
                              </button>
                              <button
                                onClick={() => handleDelete(deck)}
                                disabled={deleting === deck.id}
                                className="ac-btn ac-btn-danger self-stretch px-2.5"
                                style={{ opacity: deleting === deck.id ? 0.5 : 1 }}
                                title={t('common.delete')}
                              >
                                <i className="fa-solid fa-trash" />
                              </button>
                            </>
                          )}
                          <Link href={`/decks/${deck.id}`} className="ac-btn ml-auto">
                            <i className="fa-solid fa-eye" />
                            {t('decks.view')}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {lastPage > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="ac-btn disabled:opacity-40"
              >
                <i className="fa-solid fa-chevron-left" />
              </button>
              {Array.from({ length: lastPage }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                    p === currentPage
                      ? 'bg-amber-400 text-white'
                      : 'text-c-text-subtle hover:text-c-text hover:bg-c-elevated'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={currentPage === lastPage}
                className="ac-btn disabled:opacity-40"
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          )}
        </div>
      </div>
    </SiteLayout>
  );

  function handleDelete(deck: ApiDeck) {
    if (!isAuthenticated) return;
    if (!confirm(t('decks.deleteConfirm', { name: deck.name }))) return;
    setDeleting(deck.id);
    deleteDeck(deck.id)
      .then(() => setAllMyDecks((prev) => prev ? prev.filter((d) => d.id !== deck.id) : prev))
      .catch((e) => setMyError(e instanceof Error ? e.message : t('common.unknownError')))
      .finally(() => setDeleting(null));
  }

  function handleDuplicate(deck: ApiDeck) {
    if (!isAuthenticated) return;
    setDuplicating(deck.id);
    duplicateDeck(deck.id, locale)
      .then(() => setMyDecksVersion((v) => v + 1))
      .catch((e) => setMyError(e instanceof Error ? e.message : t('common.unknownError')))
      .finally(() => setDuplicating(null));
  }
}
