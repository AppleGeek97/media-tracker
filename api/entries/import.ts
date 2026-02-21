import { sql } from '../db.js'
import { getSingleUserId } from '../lib/single-user.js'

export async function POST(request: Request) {
  const userId = await getSingleUserId()

  try {
    const body = await request.json()
    const { entries } = body

    if (!Array.isArray(entries)) {
      return new Response(JSON.stringify({ error: 'Entries must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Insert all entries
    let imported = 0
    for (const entry of entries) {
      try {
        await sql`
          INSERT INTO media_entries (id, user_id, title, type, status, year, list_type, seasons_completed, cover_url, release_date, completed_at, created_at)
          VALUES (
            ${entry.id},
            ${userId},
            ${entry.title},
            ${entry.type},
            ${entry.status},
            ${entry.year},
            ${entry.list},
            ${entry.seasonsCompleted || null},
            ${entry.coverUrl || null},
            ${entry.releaseDate || null},
            ${entry.completedAt || null},
            ${entry.createdAt || new Date()}
          )
          ON CONFLICT (id) DO NOTHING
        `
        imported++
      } catch (error) {
        console.error('Failed to import entry:', entry, error)
      }
    }

    return new Response(
      JSON.stringify({ success: true, imported }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Import error:', error)
    return new Response(JSON.stringify({ error: 'Import failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
