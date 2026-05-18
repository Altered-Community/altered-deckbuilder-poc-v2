const ALLOWED_HOSTS = [
  'cdn.alteredcore.org',
  'altered-core-cards-api.toxicity.be',
  'alteredcore.org',
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return new Response('missing url', { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); } catch { return new Response('invalid url', { status: 400 }); }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new Response('forbidden host', { status: 403 });
  }

  const res = await fetch(url);
  if (!res.ok) return new Response('upstream error', { status: res.status });

  const data = await res.arrayBuffer();
  return new Response(data, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'image/webp',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
