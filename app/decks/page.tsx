'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDecks, deleteDeck } from '@/lib/api/deckApi';
import type { ApiDeck } from '@/lib/types/deck';
import LoginButton from '@/components/auth/LoginButton';
import SiteLayout from '@/components/layout/SiteLayout';
import { FACTIONS } from '@/lib/types/constants';

function getFactionCode(heroRef: string | undefined): string | null {
  if (!heroRef) return null;
  const parts = heroRef.split('_');
  return parts.length > 3 ? parts[3] : null;
}

export default function DecksPage() {
  const t = useTranslations();
  const { token } = useAuth();
  const [decks, setDecks] = useState<ApiDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const mounted = useRef(true);

  /* Filtres */
  const [filterFaction, setFilterFaction] = useState<string | null>(null);
  const [filterHero, setFilterHero] = useState<string | null>(null);
  const [filterFormat, setFilterFormat] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');

  useEffect(() => {
    if (!token) return;
    mounted.current = true;
    getDecks()
      .then((data) => { if (mounted.current) setDecks(data); })
      .catch((e) => { if (mounted.current) setError(e instanceof Error ? e.message : t('common.unknownError')); })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, [token, t]);

  /* Réinitialise le filtre héros si faction change */
  const handleFactionClick = (code: string) => {
    const next = filterFaction === code ? null : code;
    setFilterFaction(next);
    setFilterHero(null);
  };

  /* Héros disponibles pour la faction sélectionnée */
  const heroesForFaction = useMemo(() => {
    if (!filterFaction) return [];
    const seen = new Set<string>();
    const result: { name: string; imagePath: string | null }[] = [];
    for (const d of decks) {
      const fc = getFactionCode(d.stats?.hero?.reference);
      if (fc !== filterFaction) continue;
      const name = d.stats?.hero?.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      result.push({ name, imagePath: d.stats?.hero?.imagePath ?? null });
    }
    return result;
  }, [decks, filterFaction]);

  /* Formats disponibles */
  const formats = useMemo(() => {
    const seen = new Set<string>();
    return decks
      .filter((d) => d.format && !seen.has(d.format) && seen.add(d.format))
      .map((d) => d.format as string);
  }, [decks]);

  /* Decks filtrés */
  const filtered = useMemo(() => decks.filter((d) => {
    const fc = getFactionCode(d.stats?.hero?.reference);
    if (filterFaction && fc !== filterFaction) return false;
    if (filterHero && d.stats?.hero?.name !== filterHero) return false;
    if (filterFormat && d.format !== filterFormat) return false;
    if (filterSearch && !d.name.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  }), [decks, filterFaction, filterHero, filterFormat, filterSearch]);

  const hasFilter = !!(filterFaction || filterHero || filterFormat || filterSearch);

  return (
    <SiteLayout>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        {/* ── En-tête ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="section-title mb-0">
            <span>{t('decks.title')}</span>
            {decks.length > 0 && (
              <span className="ml-2 text-sm font-normal" style={{ color: 'var(--neutral-600)' }}>
                {filtered.length !== decks.length
                  ? `${filtered.length} / ${decks.length}`
                  : `${decks.length} deck${decks.length !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-primary-altered btn-sm">
              <i className="fa-solid fa-plus" />
              Nouveau deck
            </Link>
            <Link href="/decks/import/altered" className="btn-primary-altered btn-sm" style={{ background: 'var(--neutral-600)' }}>
              <i className="fa-solid fa-cloud-arrow-down" />
              {t('nav.importFromAltered')}
            </Link>
          </div>
        </div>

        {/* ── Barre de filtres ── */}
        <div className="card-altered p-3 flex flex-col gap-2">

          {/* Recherche + Format + Reset */}
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
                  <option value="">Tous formats</option>
                  {formats.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </>
            )}
            {hasFilter && (
              <button
                onClick={() => { setFilterFaction(null); setFilterHero(null); setFilterFormat(''); setFilterSearch(''); }}
                className="ml-auto text-xs text-c-text-subtle hover:text-amber-500 underline transition"
              >
                Réinitialiser
              </button>
            )}
          </div>

          {/* Factions */}
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

          {/* Héros (si faction sélectionnée) */}
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

          {/* États */}
          {!token && (
            <div className="text-center mt-20">
              <p className="mb-4" style={{ color: 'var(--neutral-600)' }}>{t('decks.loginRequired')}</p>
              <LoginButton />
            </div>
          )}
          {token && loading && <p className="text-sm" style={{ color: 'var(--neutral-600)' }}>{t('common.loading')}</p>}
          {token && error && <p className="text-sm text-red-500">{error}</p>}
          {token && !loading && !error && decks.length === 0 && (
            <div className="text-center mt-20">
              <p className="mb-4" style={{ color: 'var(--neutral-600)' }}>{t('decks.noDecks')}</p>
              <Link href="/" className="btn-primary-altered">{t('decks.createFirst')}</Link>
            </div>
          )}
          {token && !loading && !error && decks.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-c-text-muted mt-8">Aucun deck ne correspond aux filtres.</p>
          )}

          {/* Grille */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((deck) => {
                const heroRef     = deck.stats?.hero?.reference;
                const heroImage   = deck.stats?.hero?.imagePath ?? null;
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
                  <div key={deck.id} className="news-card h-full" style={cardStyle}>
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
                          {deck.isPublic ? t('common.public') : 'Privé'}
                        </span>
                      </div>

                      <h3 className="news-card-title">
                        {factionCode && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`https://alteredcore.org/assets/faction/${factionCode}.png`}
                            alt={factionCode}
                            style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
                          />
                        )}
                        {deck.name}
                      </h3>

                      {heroName && (
                        <p style={{ fontSize: '.8rem', opacity: 0.75, color: '#fff', margin: 0 }}>{heroName}</p>
                      )}

                      <div className="mt-auto pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.20)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span style={{ fontSize: '.8rem', color: 'rgba(255,255,255,0.75)' }}>
                            {totalCards} {t('decks.cards')}
                          </span>
                          {commonCount > 0 && (
                            <span className="flex items-center gap-1" style={{ fontSize: '.8rem' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="https://alteredcore.org/assets/gems/C.png" alt="C" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{commonCount}</span>
                            </span>
                          )}
                          {rareCount > 0 && (
                            <span className="flex items-center gap-1" style={{ fontSize: '.8rem' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="https://alteredcore.org/assets/gems/R.png" alt="R" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{rareCount}</span>
                            </span>
                          )}
                          {uniqueCount > 0 && (
                            <span className="flex items-center gap-1" style={{ fontSize: '.8rem' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="https://alteredcore.org/assets/gems/U.png" alt="U" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                              <span style={{ color: 'rgba(255,255,255,0.7)' }}>{uniqueCount}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <div className="flex gap-1">
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
                              {deleting === deck.id ? '...' : 'Supprimer'}
                            </button>
                          </div>
                          <Link href={`/decks/${deck.id}`} className="btn-primary-altered btn-sm">
                            Voir <i className="fa-solid fa-eye" />
                          </Link>
                        </div>
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
      .then(() => setDecks((prev) => prev.filter((d) => d.id !== deck.id)))
      .catch((e) => setError(e instanceof Error ? e.message : t('common.unknownError')))
      .finally(() => setDeleting(null));
  }
}
