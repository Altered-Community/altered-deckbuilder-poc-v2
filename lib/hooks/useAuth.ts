import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/store/authStore';
import { type DefaultSession } from 'next-auth';

const USE_KEYCLOAK = process.env.NEXT_PUBLIC_USE_KEYCLOAK === 'true';

interface SessionWithAccessToken extends DefaultSession {
  accessToken?: string;
}

export function useAuth() {
  const { data: session, status } = useSession() as { data: SessionWithAccessToken | null; status: 'loading' | 'authenticated' | 'unauthenticated' };
  const devToken = useAuthStore((s) => s.token);

  if (USE_KEYCLOAK) {
    return {
      session,
      token: session?.accessToken ?? null,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
    };
  }

  return {
    session: null,
    token: devToken,
    isAuthenticated: !!devToken,
    isLoading: false,
  };
}