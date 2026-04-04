// Proxies cover images to avoid canvas CORS taint.
// Only allows known image CDN hosts.

const ALLOWED_HOSTS = [
  'image.tmdb.org',
  'media.rawg.io',
  'covers.openlibrary.org',
]

export async function GET(request: Request) {
  const url = new URL(request.url)
  const imageUrl = url.searchParams.get('url')

  if (!imageUrl) {
    return new Response('Missing url', { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(imageUrl)
  } catch {
    return new Response('Invalid url', { status: 400 })
  }

  if (!ALLOWED_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host))) {
    return new Response('Disallowed host', { status: 403 })
  }

  const res = await fetch(imageUrl)
  if (!res.ok) {
    return new Response('Image fetch failed', { status: 502 })
  }

  const buffer = await res.arrayBuffer()

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=604800, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
