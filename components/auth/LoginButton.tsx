'use client';

import { useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useAuthStore } from '@/store/authStore';
import { devLogin } from '@/lib/api/authDev';

const USE_KEYCLOAK = process.env.NEXT_PUBLIC_USE_KEYCLOAK === 'true';

export default function LoginButton() {
  const { data: session, status } = useSession();
  const { token, logout } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingAuth = status === 'loading' || loading;

  console.log('[LoginButton] render:', { status, hasSession: !!session, hasToken: !!token });

  const handleDevLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await devLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    console.log('[auth] logout', USE_KEYCLOAK ? 'keycloak' : 'dev');
    if (USE_KEYCLOAK) {
      const result = await signOut({ redirect: false });
      console.log('[auth] signOut result', result);
      logout();
      window.location.href = '/';
    } else {
      logout();
    }
  };

  const isKeycloak = USE_KEYCLOAK && status === 'authenticated';
  const isDev = !USE_KEYCLOAK && !!token;

  const getLabel = () => {
    if (isKeycloak) return session?.user?.email ?? session?.user?.name ?? 'Compte';
    if (isDev) return 'Dev';
    return '';
  };

  const label = getLabel();

  if (status === 'authenticated' || token) {
    return (
      <button
        onClick={handleLogout}
        className="text-xs px-2.5 py-1 rounded border border-gray-600 text-gray-400 hover:text-red-400 hover:border-red-600 transition"
      >
        Déconnexion{label ? ` (${label})` : ''}
      </button>
    );
  }

  const handleLogin = () => {
    console.log('[auth] handleLogin, USE_KEYCLOAK:', USE_KEYCLOAK);
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