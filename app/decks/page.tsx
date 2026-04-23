'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getDecks, deleteDeck } from '@/lib/api/deckApi';
import type { ApiDeck } from '@/lib/types/deck';
import LoginButton from '@/components/auth/LoginButton';
import ThemeToggle from '@/components/ThemeToggle';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function DecksPage() {
  const { token } = useAuth();
  const [decks, setDecks] = useState<ApiDeck[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    getDecks()
      .then(setDecks)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur inconnue'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDelete = async (deck: ApiDeck) => {
    if (!token) return;
    if (!confirm(`Supprimer "${deck.name}" ?`)) return;
    setDeleting(deck.id);
    try {
      await deleteDeck(deck.id);
      setDecks((prev) => prev.filter((d) => d.id !== deck.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur suppression');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-c-bg flex flex-col">
      <header className="flex items-center gap-3 px-6 py-3 bg-c-surface border-b border-c-border-subtle">
        <Link href="/" className="text-c-text-muted hover:text-c-text transition text-sm">
          ← Accueil
        </Link>
        <span className="text-c-border">|</span>
        <span className="text-sm font-bold text-c-text">Mes decks</span>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/decks/import"
            className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/60 text-blue-700 dark:text-blue-400 rounded border border-blue-300 dark:border-blue-800/50 transition"
          >
            Importer
          </Link>
          <LoginButton />
        </div>
      </header>

      <main className="flex-1 w-full px-6 py-8">
        {!token && (
          <div className="text-center text-c-text-muted mt-20">
            <p className="mb-4">Connectez-vous pour voir vos decks.</p>
            <LoginButton />
          </div>
        )}
        {token && loading && <p className="text-c-text-muted text-sm">Chargement...</p>}
        {token && error && <p className="text-red-400 text-sm">{error}</p>}
        {token && !loading && !error && decks.length === 0 && (
          <div className="text-center text-c-text-muted mt-20">
            <p className="mb-4">Aucun deck sauvegardé.</p>
            <Link href="/" className="text-blue-500 hover:underline text-sm">Créer un deck</Link>
          </div>
        )}

        {decks.length > 0 && (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {decks.map((deck) => {
              const heroImage = deck.stats?.hero?.imagePath ?? null;
              const rareCount = deck.stats?.byRarity['R'] ?? 0;
              const uniqueCount = deck.stats?.byRarity['U'] ?? 0;
              const totalCards = deck.stats?.totalCards ?? 0;
              const hasImage = !!heroImage;

              return (
                <div
                  key={deck.id}
                  className="relative flex flex-col justify-between aspect-square border border-c-border rounded-xl overflow-hidden hover:border-c-text-muted transition group bg-c-surface"
                >
                  {hasImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={heroImage!}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-80"
                    />
                  )}
                  <div className={`absolute inset-0 bg-gradient-to-t ${hasImage ? 'from-black/85 via-black/40 to-black/25' : 'from-black/70 via-black/50 to-black/30'}`} />

                  <div className="relative z-10 flex flex-col justify-between h-full p-4">
                    <div>
                      <p className="text-white font-semibold text-base leading-snug line-clamp-2 mb-2 drop-shadow">
                        {deck.name}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {deck.format && (
                          <span className="text-xs bg-black/50 text-gray-200 px-1.5 py-0.5 rounded">
                            {deck.format}
                          </span>
                        )}
                        {deck.isPublic && (
                          <span className="text-xs bg-green-800/60 text-green-300 px-1.5 py-0.5 rounded">
                            Public
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex gap-2 mb-3">
                        <span className="text-xs text-gray-300">
                          <span className="font-bold text-white">{totalCards}</span> cartes
                        </span>
                        {rareCount > 0 && (
                          <span className="text-xs text-blue-300">
                            <span className="font-bold">{rareCount}</span> R
                          </span>
                        )}
                        {uniqueCount > 0 && (
                          <span className="text-xs text-yellow-400">
                            <span className="font-bold">{uniqueCount}</span> U
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 mb-3 drop-shadow">
                        {formatDate(deck.updatedAt ?? deck.createdAt)}
                      </p>

                      <div className="flex gap-2">
                        <Link
                          href={`/decks/${deck.id}`}
                          className="flex-1 text-center text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1.5 rounded border border-white/30 transition backdrop-blur-sm"
                        >
                          Éditer
                        </Link>
                        <button
                          onClick={() => handleDelete(deck)}
                          disabled={deleting === deck.id}
                          className="text-xs text-white/60 hover:text-red-300 px-2 py-1.5 rounded border border-white/20 hover:border-red-400/50 transition disabled:opacity-40"
                          title="Supprimer"
                        >
                          {deleting === deck.id ? '...' : '✕'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
