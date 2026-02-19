import { sql } from '../db.js'
import {
  verifyRefreshToken,
  generateAccessToken,
} from '../lib/auth.js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { refresh_token } = body

    if (!refresh_token) {
      return new Response(
        JSON.stringify({ error: 'Refresh token is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Verify refresh token signature
    const payload = await verifyRefreshToken(refresh_token)

    if (!payload) {
      return new Response(JSON.stringify({ error: 'Invalid refresh token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check if refresh token exists in database and is not revoked
    const tokens = await sql`
      SELECT rt.id, rt.expires_at, rt.revoked_at, u.username
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token = ${refresh_token}
    `

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ error: 'Refresh token not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const tokenRecord = tokens[0]

    // Check if token is revoked
    if (tokenRecord.revoked_at !== null) {
      return new Response(JSON.stringify({ error: 'Refresh token revoked' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check if token is expired
    const expiresAt = new Date(tokenRecord.expires_at)
    if (expiresAt < new Date()) {
      // Delete expired token
      await sql`
        DELETE FROM refresh_tokens WHERE token = ${refresh_token}
      `
      return new Response(JSON.stringify({ error: 'Refresh token expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Generate new access token
    const access_token = await generateAccessToken({
      userId: payload.userId,
      username: tokenRecord.username,
    })

    return new Response(JSON.stringify({ access_token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Token refresh error:', error)
    return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
