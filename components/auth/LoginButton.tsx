'use client';

import { useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useAuthStore } from '@/store/authStore';
import { devLogin } from '@/lib/api/deckApi';

const USE_KEYCLOAK = process.env.NEXT_PUBLIC_USE_KEYCLOAK === 'true';

export default function LoginButton() {
  const { data: session, status } = useSession();
  const { token, setToken, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingAuth = status === 'loading' || loading;

  const handleDevLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await devLogin();
      setToken(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (USE_KEYCLOAK) {
      signOut();
    } else {
      logout();
    }
  };

  if (session || token) {
    const label = session 
      ? session.user?.email ?? session.user?.name 
      : 'Dev';
    return (
      <button
        onClick={handleLogout}
        className="text-xs px-2.5 py-1 rounded border border-gray-600 text-gray-400 hover:text-red-400 hover:border-red-600 transition"
      >
        Déconnexion ({label})
      </button>
    );
  }

  const handleLogin = () => {
    if (USE_KEYCLOAK) {
      signIn('keycloak');
    } else {
      handleDevLogin();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        onClick={handleLogin}
        disabled={loadingAuth}
        className="text-xs px-2.5 py-1 rounded border border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white transition disabled:opacity-50"
      >
        {loadingAuth ? '...' : USE_KEYCLOAK ? 'Connexion Keycloak' : 'Connexion (dev)'}
      </button>
    </div>
  );
}