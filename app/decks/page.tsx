'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDecks, deleteDeck } from '@/lib/api/deckApi';
import type { ApiDeck } from '@/lib/types/deck';
import LoginButton from '@/components/auth/LoginButton';
import SiteLayout from '@/components/layout/SiteLayout';

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

  useEffect(() => {
    if (!token) return;
    mounted.current = true;
    getDecks()
      .then((data) => {
        if (mounted.current) setDecks(data);
      })
      .catch((e) => {
        if (mounted.current) setError(e instanceof Error ? e.message : t('common.unknownError'));
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => { mounted.current = false; };
  }, [token, t]);

  const handleDelete = async (deck: ApiDeck) => {
    if (!token) return;
    if (!confirm(t('decks.deleteConfirm', { name: deck.name }))) return;
    setDeleting(deck.id);
    try {
      await deleteDeck(deck.id);
      setDecks((prev) => prev.filter((d) => d.id !== deck.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.unknownError'));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <SiteLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">

        {/* Titre + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="section-title mb-0">
            <span>{t('decks.title')}</span>
          </div>
          <div className="flex items-center gap-3">
            {decks.length > 0 && (
              <span className="text-sm" style={{ color: 'var(--neutral-600)' }}>
                {decks.length} deck{decks.length !== 1 ? 's' : ''}
              </span>
            )}
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

        {/* États */}
        {!token && (
          <div className="text-center mt-20">
            <p className="mb-4" style={{ color: 'var(--neutral-600)' }}>
              {t('decks.loginRequired')}
            </p>
            <LoginButton />
          </div>
        )}
        {token && loading && (
          <p className="text-sm" style={{ color: 'var(--neutral-600)' }}>
            {t('common.loading')}
          </p>
        )}
        {token && error && <p className="text-sm text-red-500">{error}</p>}
        {token && !loading && !error && decks.length === 0 && (
          <div className="text-center mt-20">
            <p className="mb-4" style={{ color: 'var(--neutral-600)' }}>
              {t('decks.noDecks')}
            </p>
            <Link href="/" className="btn-primary-altered">
              {t('decks.createFirst')}
            </Link>
          </div>
        )}

        {/* Grille de decks */}
        {decks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {decks.map((deck) => {
              const heroRef      = deck.stats?.hero?.reference;
              const heroImage    = deck.stats?.hero?.imagePath ?? null;
              const heroName     = deck.stats?.hero?.name ?? null;
              const factionCode  = getFactionCode(heroRef);
              const totalCards   = deck.stats?.totalCards ?? 0;
              const commonCount  = deck.stats?.byRarity['C'] ?? 0;
              const rareCount    = deck.stats?.byRarity['R'] ?? 0;
              const uniqueCount  = deck.stats?.byRarity['U'] ?? 0;

              const cardStyle: React.CSSProperties = heroImage
                ? {
                    borderTop: '3px solid var(--primary-400)',
                    backgroundImage: `linear-gradient(to right, rgba(140,67,42,0.70) 30%, rgba(140,67,42,0) 100%), url(${heroImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'left top',
                  }
                : { borderTop: '3px solid var(--primary-400)' };

              return (
                <div key={deck.id} className="news-card h-full" style={cardStyle}>
                  <div className="news-card-body">

                    {/* Badges */}
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

                    {/* Titre + icône faction */}
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

                    {/* Nom du héros */}
                    {heroName && (
                      <p style={{ fontSize: '.8rem', opacity: 0.75, color: '#fff', margin: 0 }}>
                        {heroName}
                      </p>
                    )}

                    {/* Pied de carte */}
                    <div className="mt-auto pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.20)' }}>

                      {/* Compteurs cartes + gemmes */}
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

                      {/* Boutons */}
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
    </SiteLayout>
  );
}
