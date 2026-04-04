import { requireAuth, AuthError } from './lib/auth.js'

async function fetchMovieCover(title: string): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return null
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}&page=1`
  )
  const data = await res.json() as any
  const path = data.results?.[0]?.poster_path
  return path ? `https://image.tmdb.org/t/p/w200${path}` : null
}

async function fetchTVCover(title: string): Promise<string | null> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return null
  const res = await fetch(
    `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(title)}&page=1`
  )
  const data = await res.json() as any
  const path = data.results?.[0]?.poster_path
  return path ? `https://image.tmdb.org/t/p/w200${path}` : null
}

async function fetchGameCover(title: string): Promise<string | null> {
  const apiKey = process.env.RAWG_API_KEY
  if (!apiKey) return null
  const res = await fetch(
    `https://api.rawg.io/api/games?key=${apiKey}&search=${encodeURIComponent(title)}&page_size=1`
  )
  const data = await res.json() as any
  return data.results?.[0]?.background_image ?? null
}

async function fetchComicCover(title: string): Promise<string | null> {
  const res = await fetch(
    `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1&fields=cover_i`
  )
  const data = await res.json() as any
  const coverId = data.docs?.[0]?.cover_i
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null
}

export async function GET(request: Request) {
  try {
    await requireAuth(request)
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw error
  }

  const url = new URL(request.url)
  const title = url.searchParams.get('title')
  const type = url.searchParams.get('type')

  if (!title || !type) {
    return new Response(JSON.stringify({ error: 'Missing title or type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let imageUrl: string | null = null

  try {
    if (type === 'movie') imageUrl = await fetchMovieCover(title)
    else if (type === 'tv') imageUrl = await fetchTVCover(title)
    else if (type === 'game') imageUrl = await fetchGameCover(title)
    else if (type === 'comic') imageUrl = await fetchComicCover(title)
  } catch (e) {
    console.error('Cover fetch error:', e)
  }

  return new Response(JSON.stringify({ url: imageUrl }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
