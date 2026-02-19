import { sql } from '../db.js'
import bcrypt from 'bcryptjs'
import {
  generateAccessToken,
  generateRefreshToken,
  type TokenPayload,
} from '../lib/auth.js'
import { checkRateLimit, getClientIP } from '../lib/rate-limit.js'

export async function POST(request: Request) {
  // Rate limiting: 10 login attempts per 15 minutes per IP
  const clientIP = getClientIP(request)
  const rateLimit = await checkRateLimit(`login:${clientIP}`, 10, 15)

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many login attempts. Please try again later.',
        resetAt: rateLimit.resetAt
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': rateLimit.resetAt
            ? Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000).toString()
            : '900'
        },
      }
    )
  }

  try {
    const body = await request.json()
    const { username, password } = body

    // Validate input
    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Username and password are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Find user by username
    const users = await sql`
      SELECT id, password_hash FROM users
      WHERE username = ${username}
    `

    if (users.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const user = users[0]

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash)

    if (!passwordMatch) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Update last_login_at
    await sql`
      UPDATE users
      SET last_login_at = NOW()
      WHERE id = ${user.id}
    `

    // Generate JWT tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: username,
    }

    const [access_token, refresh_token] = await Promise.all([
      generateAccessToken(tokenPayload),
      generateRefreshToken(tokenPayload),
    ])

    // Store refresh token in database
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

    await sql`
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${refresh_token}, ${expiresAt.toISOString()})
    `

    return new Response(
      JSON.stringify({
        access_token,
        refresh_token,
        userId: user.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Login error:', error)
    return new Response(JSON.stringify({ error: 'Login failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
