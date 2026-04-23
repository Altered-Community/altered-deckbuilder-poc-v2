const DEV_AUTH_PAYLOAD = {
  sub: process.env.NEXT_PUBLIC_DEV_AUTH_SUB ?? '',
  email: process.env.NEXT_PUBLIC_DEV_AUTH_EMAIL ?? '',
  username: process.env.NEXT_PUBLIC_DEV_AUTH_USERNAME ?? '',
};

export async function devLogin(): Promise<string> {
  const DECK_API_BASE =
    typeof window === 'undefined'
      ? (process.env.NEXT_PUBLIC_DECK_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
      : '/deck-api-proxy';

  const res = await fetch(`${DECK_API_BASE}/dev/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DEV_AUTH_PAYLOAD),
  });
  if (!res.ok) throw new Error(`Auth dev échouée : ${res.status}`);
  const data = await res.json();
  const token = data.token ?? data.access_token ?? data.bearer ?? data.accessToken;
  if (!token) throw new Error('Token introuvable dans la réponse');
  return token;
}