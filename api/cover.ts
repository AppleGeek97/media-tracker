const TMDB_IMG = 'https://image.tmdb.org/t/p/w200'

const ALLOWED_PROXY_HOSTS = ['image.tmdb.org', 'media.rawg.io', 'covers.openlibrary.org']

async function proxyImage(imageUrl: string): Promise<Response> {
  let parsed: URL
  try { parsed = new URL(imageUrl) } catch {
    return new Response('Invalid url', { status: 400 })
  }
  if (!ALLOWED_PROXY_HOSTS.some(h => parsed.hostname === h)) {
    return new Response('Disallowed host', { status: 403 })
  }
  const res = await fetch(imageUrl)
  if (!res.ok) return new Response('Upstream error', { status: 502 })
  const buffer = await res.arrayBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=604800, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function fetchMovieCovers(title: string): Promise<string[]> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return []
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}&page=1`
  )
  const data = await res.json() as any
  return (data.results ?? [])
    .filter((r: any) => r.poster_path)
    .slice(0, 5)
    .map((r: any) => `${TMDB_IMG}${r.poster_path}`)
}

async function fetchTVCovers(title: string): Promise<string[]> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return []
  const res = await fetch(
    `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(title)}&page=1`
  )
  const data = await res.json() as any
  return (data.results ?? [])
    .filter((r: any) => r.poster_path)
    .slice(0, 5)
    .map((r: any) => `${TMDB_IMG}${r.poster_path}`)
}

async function fetchGameCovers(title: string): Promise<string[]> {
  const apiKey = process.env.RAWG_API_KEY
  if (!apiKey) return []
  const res = await fetch(
    `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(title)}&page_size=5`
  )
  const data = await res.json() as any
  return (data.results ?? [])
    .filter((r: any) => r.background_image)
    .map((r: any) => r.background_image as string)
}

async function fetchComicCovers(title: string): Promise<string[]> {
  const res = await fetch(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5&fields=cover_i`
  )
  const data = await res.json() as any
  return (data.docs ?? [])
    .filter((d: any) => d.cover_i)
    .map((d: any) => `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`)
}

export async function GET(request: Request) {
  const url = new URL(request.url)

  // Image proxy mode — used by AnsiArt to avoid CORS issues
  const proxyUrl = url.searchParams.get('proxy')
  if (proxyUrl) return proxyImage(proxyUrl)

  // Cover search mode
  const title = url.searchParams.get('title')
  const type = url.searchParams.get('type')

  if (!title || !type) {
    return new Response(JSON.stringify({ error: 'Missing title or type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let urls: string[] = []
  try {
    if (type === 'movie') urls = await fetchMovieCovers(title)
    else if (type === 'tv') urls = await fetchTVCovers(title)
    else if (type === 'game') urls = await fetchGameCovers(title)
    else if (type === 'comic') urls = await fetchComicCovers(title)
  } catch (e) {
    console.error('Cover fetch error:', e)
  }

  return new Response(JSON.stringify({ urls }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
