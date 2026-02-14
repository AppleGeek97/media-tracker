import { sql } from '../db.js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { refresh_token } = body

    if (!refresh_token) {
      return new Response(JSON.stringify({ error: 'Refresh token is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Revoke the refresh token by setting revoked_at
    await sql`
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE token = ${refresh_token}
    `

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Signout error:', error)
    return new Response(JSON.stringify({ error: 'Signout failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
