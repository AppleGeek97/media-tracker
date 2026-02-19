import { sql } from '../db.js'
import { verifyAccessToken, AuthError } from '../lib/auth.js'

export async function POST(request: Request) {
  // Authenticate request
  let auth
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Unauthorized')
    }
    const token = authHeader.substring(7)
    auth = await verifyAccessToken(token)
    if (!auth) {
      throw new AuthError('Invalid token')
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw error
  }

  try {
    const body = await request.json()
    const { revokeAll = false } = body

    if (revokeAll) {
      // Revoke ALL refresh tokens for this user (sign out from all devices)
      await sql`
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE user_id = ${auth.userId}
      `
    } else {
      // Revoke only the tokens that are still valid
      await sql`
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE user_id = ${auth.userId}
        AND revoked_at IS NULL
        AND expires_at > NOW()
      `
    }

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
