import { sql } from '../db.js'
import { getSingleUserId } from '../lib/single-user.js'

export async function POST(request: Request) {
  const userId = await getSingleUserId()

  try {
    const body = await request.json()
    const { title, type, status, year, listType, seasonsCompleted, coverUrl, releaseDate, completedAt } = body

    if (!title || !type || !status || !listType) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const result = await sql`
      INSERT INTO media_entries (user_id, title, type, status, year, list_type, seasons_completed, cover_url, release_date, completed_at)
      VALUES (
        ${userId},
        ${title},
        ${type},
        ${status},
        ${year || null},
        ${listType},
        ${seasonsCompleted || null},
        ${coverUrl || null},
        ${releaseDate || null},
        ${completedAt || null}
      )
      RETURNING *
    `

    const entry = result[0]
    return new Response(
      JSON.stringify({
        entry: {
          ...entry,
          createdAt: new Date(entry.created_at),
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error creating entry:', error)
    return new Response(JSON.stringify({ error: 'Failed to create entry' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
