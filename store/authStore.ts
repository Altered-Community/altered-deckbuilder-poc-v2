import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { devLogin } from '@/lib/api/authDev';

const USE_KEYCLOAK = process.env.NEXT_PUBLIC_USE_KEYCLOAK === 'true';

interface AuthState {
  token: string | null;
  tokenExpiresAt: number | null;
  refreshTokenPromise: Promise<string> | null;
  setToken: (token: string | null) => void;
  setTokenExpiresAt: (expiresAt: number | null) => void;
  getValidToken: () => Promise<string>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      tokenExpiresAt: null,
      refreshTokenPromise: null,
      setToken: (token) => set({ token }),
      setTokenExpiresAt: (expiresAt) => set({ tokenExpiresAt: expiresAt }),
      getValidToken: async () => {
        const { token, tokenExpiresAt: expiresAt, refreshTokenPromise } = get();

        if (refreshTokenPromise) return refreshTokenPromise;

        if (USE_KEYCLOAK) {
          const now = Date.now();
          const timeLeft = expiresAt ? expiresAt - now : 0;
          if (token && expiresAt && now < expiresAt - 30_000) {
            console.log('[auth] Keycloak token OK (expires in', Math.round(timeLeft / 1000), 's)');
            return token;
          }
          console.log('[auth] Keycloak token expiré ou absent, refresh...');
          const res = await fetch('/api/auth/session');
          const session = await res.json();
          const newToken = session?.accessToken;
          if (newToken) {
            console.log('[auth] Keycloak token rafraîchi, expires in', Math.round((session.expires - now) / 1000), 's');
            set({
              token: newToken,
              tokenExpiresAt: session.expires ?? null,
              refreshTokenPromise: null,
            });
            return newToken;
          }
          throw new Error('Session expired');
        }

        if (token) {
          console.log('[auth] Dev token OK:', token.substring(0, 20) + '...');
          return token;
        }

        console.log('[auth] Pas de dev token, login...');
        const promise = devLogin().then((token) => {
          console.log('[auth] Dev login OK:', token.substring(0, 20) + '...');
          set({ token, refreshTokenPromise: null });
          return token;
        }).catch((err) => {
          set({ token: null, refreshTokenPromise: null });
          throw err;
        });

        set({ refreshTokenPromise: promise });
        return promise;
      },
      logout: () => set({ token: null, tokenExpiresAt: null, refreshTokenPromise: null }),
    }),
    { name: 'altered-auth' }
  )
);

export const getValidToken = useAuthStore.getState().getValidToken;